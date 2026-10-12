package com.codesentinel.analysis;

import com.codesentinel.model.*;
import java.util.*;
import java.util.regex.*;

public class SecurityAnalyzer {
  private final List<Finding> findings = new ArrayList<>();
  private final FindingFactory factory;
  private final Map<String, String> provenance = new HashMap<>();
  private String function = "global";

  public SecurityAnalyzer(FindingFactory factory) {
    this.factory = factory;
  }

  public List<Finding> analyze(Node ast) {
    visit(ast);
    return findings;
  }

  private void visit(Node n) {
    // sizeof operands are type-checked but never executed in the supported non-VLA subset.
    if (n.kind.equals("Sizeof")) return;
    if (n.kind.equals("Function")) {
      String previous = function;
      function = n.text("name");
      provenance.clear();
      n.children.forEach(this::visit);
      function = previous;
      provenance.clear();
      return;
    }
    if (Set.of("If", "While", "For", "DoWhile", "Unsupported").contains(n.kind)
        || (n.kind.equals("Binary") && Set.of("&&", "||").contains(n.text("operator")))) {
      provenance.clear();
      for (Node child : n.children) {
        provenance.clear();
        visit(child);
      }
      provenance.clear();
      return;
    }
    n.children.forEach(this::visit);
    if (n.kind.equals("Declaration") && !n.children.isEmpty()) {
      Node value = n.children.getFirst();
      provenance.put(n.text("symbolId"), provenance(value));
      secret(n, n.text("name"), value, n.text("symbolId"));
    }
    if (n.kind.equals("Assignment") && n.children.size() == 2) {
      Node lhs = n.children.get(0), rhs = n.children.get(1);
      if (lhs.kind.equals("Identifier")) {
        provenance.put(
            lhs.text("symbolId"), n.text("operator").equals("=") ? provenance(rhs) : "UNKNOWN");
        secret(n, lhs.text("name"), rhs, lhs.text("symbolId"));
      }
    }
    if (!FindingFactory.libraryCall(n)) {
      if (n.kind.equals("Call")) provenance.clear();
      return;
    }
    String name = FindingFactory.callName(n);
    List<Node> args = FindingFactory.arguments(n);
    switch (name) {
      case "gets" ->
          add(
              "CS-SEC-001",
              "Unsafe gets input",
              "HIGH",
              "HIGH",
              n,
              "",
              "gets has no destination-length parameter and cannot bound input.",
              "Replace with fgets and validate the result.",
              "An unsafe API is observed; exploitability is not established.");
      case "strcpy", "strcat", "sprintf" ->
          add(
              "CS-SEC-00" + (name.equals("strcpy") ? 2 : name.equals("strcat") ? 3 : 4),
              "Unbounded " + name + " operation",
              "MEDIUM",
              "MEDIUM",
              n,
              "",
              "This API does not receive the destination capacity. Safety depends on the actual"
                  + " input length and buffer size.",
              "Use an operation with an explicit destination capacity and check truncation.",
              "Source/destination lengths and all paths are not proven.");
      case "scanf", "sscanf", "fscanf" -> {
        int formatIndex = name.equals("scanf") ? 0 : 1;
        if (args.size() > formatIndex
            && args.get(formatIndex).kind.equals("Literal")
            && unboundedString(decode(args.get(formatIndex).text("value"))))
          add(
              "CS-SEC-005",
              "Unbounded formatted string input",
              "HIGH",
              "HIGH",
              n,
              "",
              "A literal format contains an unsuppressed %s or %[ conversion without a field width.",
              "Set a width smaller than the destination capacity, allowing space for the"
                  + " terminator, or use fgets.",
              "A width bounds this conversion but does not by itself prove destination safety.");
        if (args.size() > formatIndex && args.get(formatIndex).kind.equals("Literal")) {
          int argument = formatIndex + 1;
          for (var conversion : conversions(decode(args.get(formatIndex).text("value"))))
            if (!conversion.suppressed() && argument < args.size()) markInput(args.get(argument++));
        } else
          for (int j = formatIndex + 1; j < args.size(); j++)
            provenance.put(FindingFactory.symbol(args.get(j)), "UNKNOWN");
      }
      case "system" -> {
        String origin = args.isEmpty() ? "UNKNOWN" : provenance(args.getFirst());
        if (origin.equals("INPUT"))
          add(
              "CS-SEC-006",
              "Input-derived command argument",
              "HIGH",
              "MEDIUM",
              n,
              args.isEmpty() ? "" : FindingFactory.symbol(args.getFirst()),
              "A simple local flow connects an input destination to a system command argument.",
              "Avoid shell command construction; use a fixed executable and validated argument"
                  + " list.",
              "This is local assignment provenance, not path-sensitive or interprocedural taint"
                  + " analysis.");
        else if (!origin.equals("CONSTANT"))
          add(
              "CS-SEC-007",
              "Command argument provenance unknown",
              "INFORMATIONAL",
              "LOW",
              n,
              "",
              "The command argument could not be classified by the local provenance model.",
              "Review the command origin and avoid passing untrusted command text.",
              "The presence of system is not proof of command injection.");
      }
      default -> {}
    }
    if (Set.of("strcpy", "strcat", "sprintf", "snprintf", "memcpy", "memmove", "memset", "realloc")
            .contains(name)
        && !args.isEmpty()) provenance.put(FindingFactory.symbol(args.getFirst()), "UNKNOWN");
    if (Set.of("gets", "fgets").contains(name) && !args.isEmpty()) markInput(args.getFirst());
  }

  private void markInput(Node n) {
    String id = FindingFactory.symbol(n);
    if (!id.isEmpty()) provenance.put(id, "INPUT");
  }

  private String provenance(Node n) {
    if (n.kind.equals("Literal")) return "CONSTANT";
    if (n.kind.equals("Identifier")) return provenance.getOrDefault(n.text("symbolId"), "UNKNOWN");
    return "UNKNOWN";
  }

  public static boolean secretName(String name) {
    return name.matches("(?i).*(password|passwd|pwd|api_?key|secret|token).*");
  }

  private void secret(Node n, String name, Node value, String symbol) {
    if (secretName(name)
        && value.kind.equals("Literal")
        && value.text("literalType").equals("string")
        && !decode(value.text("value")).isEmpty())
      add(
          "CS-SEC-008",
          "Possible hardcoded credential",
          "MEDIUM",
          "LOW",
          n,
          symbol,
          "A credential-like identifier is assigned a string literal; the displayed value is"
              + " redacted.",
          "Move real credentials to runtime configuration and rotate exposed values.",
          "Names and literals are heuristic evidence; placeholders can match.");
  }

  private void add(
      String rule,
      String name,
      String severity,
      String confidence,
      Node n,
      String symbol,
      String explanation,
      String remediation,
      String limitation) {
    findings.add(
        factory.create(
            rule,
            name,
            "SECURITY",
            severity,
            confidence,
            n,
            function,
            symbol,
            explanation,
            remediation,
            limitation));
  }

  private record Conversion(char type, boolean suppressed, boolean bounded) {}

  public static boolean unboundedString(String format) {
    return conversions(format).stream()
        .anyMatch(c -> (c.type() == 's' || c.type() == '[') && !c.suppressed() && !c.bounded());
  }

  private static List<Conversion> conversions(String format) {
    List<Conversion> out = new ArrayList<>();
    for (int i = 0; i < format.length(); i++)
      if (format.charAt(i) == '%') {
        i++;
        if (i >= format.length()) break;
        if (format.charAt(i) == '%') continue;
        boolean suppressed = false;
        if (format.charAt(i) == '*') {
          suppressed = true;
          i++;
        }
        int start = i;
        while (i < format.length() && Character.isDigit(format.charAt(i))) i++;
        boolean width = i > start && format.substring(start, i).chars().anyMatch(c -> c != '0');
        while (i < format.length() && "hljztL".indexOf(format.charAt(i)) >= 0) i++;
        if (i < format.length() && "diouxXaAeEfFgGcspn[".indexOf(format.charAt(i)) >= 0) {
          char type = format.charAt(i);
          out.add(new Conversion(type, suppressed, width));
          if (type == '[') {
            i++;
            if (i < format.length() && format.charAt(i) == '^') i++;
            if (i < format.length() && format.charAt(i) == ']') i++;
            while (i < format.length() && format.charAt(i) != ']') i++;
          }
        }
      }
    return out;
  }

  public static String decode(String literal) {
    Matcher m = Pattern.compile("\"((?:\\\\.|[^\"\\\\])*)\"").matcher(literal);
    StringBuilder out = new StringBuilder();
    while (m.find()) {
      String s = m.group(1);
      for (int i = 0; i < s.length(); i++) {
        char c = s.charAt(i);
        if (c != '\\' || i + 1 == s.length()) {
          out.append(c);
          continue;
        }
        char e = s.charAt(++i);
        if (e == 'x') {
          int j = i + 1;
          while (j < s.length() && Character.digit(s.charAt(j), 16) >= 0) j++;
          if (j > i + 1) {
            try {
              out.append((char) Integer.parseInt(s.substring(i + 1, j), 16));
            } catch (NumberFormatException ignored) {
            }
            i = j - 1;
          }
        } else if (e >= '0' && e <= '7') {
          int j = i + 1;
          while (j < s.length() && j < i + 3 && s.charAt(j) >= '0' && s.charAt(j) <= '7') j++;
          out.append((char) Integer.parseInt(s.substring(i, j), 8));
          i = j - 1;
        } else
          out.append(
              switch (e) {
                case 'n' -> '\n';
                case 'r' -> '\r';
                case 't' -> '\t';
                case 'b' -> '\b';
                case 'f' -> '\f';
                default -> e;
              });
      }
    }
    return out.toString();
  }
}
