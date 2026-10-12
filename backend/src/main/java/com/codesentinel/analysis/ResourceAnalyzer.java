package com.codesentinel.analysis;

import com.codesentinel.model.*;
import java.util.*;

public class ResourceAnalyzer {
  public record Allocation(
      String id,
      String functionName,
      String api,
      String variable,
      String symbolId,
      SourceRange range,
      boolean insideLoop,
      String ownership,
      boolean nullCheckRecognized,
      boolean localFreeVisible) {}

  public record Result(
      int allocationCalls,
      int deallocationCalls,
      int reallocationCalls,
      int allocationsInsideLoops,
      List<Allocation> allocations,
      List<Finding> findings) {}

  private final FindingFactory factory;
  private final List<Allocation> allocations = new ArrayList<>();
  private final List<Finding> findings = new ArrayList<>();
  private final Map<Node, Node> parents = new IdentityHashMap<>();
  private int frees = 0, reallocs = 0;
  private final int arrayThreshold;

  public ResourceAnalyzer(FindingFactory factory, int arrayThreshold) {
    this.factory = factory;
    this.arrayThreshold = arrayThreshold;
  }

  public Result analyze(Node ast) {
    link(ast);
    for (Node n : ast.all())
      if (n.kind.equals("Declaration") && !inFunction(n)) largeArray(n, "global");
    for (Node fn : ast.all())
      if (fn.kind.equals("Function")) {
        List<Node> nodes = fn.all();
        for (Node n : nodes) {
          if (n.kind.equals("Declaration")) largeArray(n, fn.text("name"));
          if (!FindingFactory.libraryCall(n)) continue;
          String api = FindingFactory.callName(n);
          if (api.equals("free")) {
            frees++;
            continue;
          }
          if (!Set.of("malloc", "calloc", "realloc").contains(api)) continue;
          if (api.equals("realloc")) reallocs++;
          Node parent = parents.get(n);
          while (parent != null && parent.kind.equals("Cast")) parent = parents.get(parent);
          String symbol = "", variable = "";
          if (parent != null && parent.kind.equals("Declaration")) {
            symbol = parent.text("symbolId");
            variable = parent.text("name");
          } else if (parent != null
              && parent.kind.equals("Assignment")
              && parent.children.size() == 2
              && parent.children.get(1).all().contains(n)
              && parent.children.get(0).kind.equals("Identifier")) {
            symbol = parent.children.get(0).text("symbolId");
            variable = parent.children.get(0).text("name");
          }
          final String id = symbol;
          boolean freeVisible =
              !id.isEmpty()
                  && nodes.stream()
                      .filter(
                          c ->
                              FindingFactory.libraryCall(c)
                                  && FindingFactory.callName(c).equals("free"))
                      .anyMatch(
                          c ->
                              !FindingFactory.arguments(c).isEmpty()
                                  && FindingFactory.symbol(FindingFactory.arguments(c).getFirst())
                                      .equals(id)
                                  && c.range.startOffset() > n.range.startOffset());
          boolean escaped = escapes(n, id, nodes);
          boolean guard =
              !id.isEmpty() && nodes.stream().anyMatch(c -> recognizedGuard(c, id, n, nodes));
          boolean loop = insideLoop(n);
          allocations.add(
              new Allocation(
                  n.id,
                  fn.text("name"),
                  api,
                  variable,
                  symbol,
                  n.range,
                  loop,
                  api.equals("realloc")
                      ? "UNKNOWN_REALLOC"
                      : escaped ? "ESCAPED_OR_UNKNOWN" : symbol.isEmpty() ? "UNASSIGNED" : "LOCAL",
                  guard,
                  freeVisible));
          if (loop)
            add(
                "CS-RES-003",
                "Allocation inside loop",
                "LOW",
                "HIGH",
                n,
                fn.text("name"),
                symbol,
                "An allocation call appears in a repeated loop region.",
                "Review whether allocation can be moved outside the loop or storage reused.",
                "The source site is counted once; iteration count and runtime cost are unknown.");
          if (api.equals("realloc")) continue;
          if (!guard && !escaped)
            add(
                "CS-RES-001",
                "No recognized allocation-failure guard",
                "MEDIUM",
                "LOW",
                n,
                fn.text("name"),
                symbol,
                "No supported local null guard was recognized for this allocation result.",
                "Check for a null allocation result before accessing the allocated storage.",
                "This pattern detector can miss alternative checking strategies.");
          if (!escaped && !freeVisible)
            add(
                "CS-RES-002",
                "No visible local release",
                "MEDIUM",
                "LOW",
                n,
                fn.text("name"),
                symbol,
                "No later free of this locally retained result was recognized in the function.",
                "Review ownership and release storage when its owner finishes using it.",
                "This is not proof of a leak; aliases and all control paths are not modeled.");
        }
      }
    return new Result(
        allocations.size(),
        frees,
        reallocs,
        (int) allocations.stream().filter(Allocation::insideLoop).count(),
        allocations,
        findings);
  }

  private void link(Node n) {
    for (Node c : n.children) {
      parents.put(c, n);
      link(c);
    }
  }

  private boolean inFunction(Node n) {
    for (Node p = parents.get(n); p != null; p = parents.get(p))
      if (p.kind.equals("Function")) return true;
    return false;
  }

  private boolean insideLoop(Node n) {
    Node child = n;
    for (Node p = parents.get(n); p != null; child = p, p = parents.get(p)) {
      if (Set.of("While", "DoWhile").contains(p.kind)) return true;
      if (p.kind.equals("For") && p.children.get(0) != child) return true;
    }
    return false;
  }

  private boolean escapes(Node allocation, String id, List<Node> nodes) {
    Node parent = parents.get(allocation);
    while (parent != null && parent.kind.equals("Cast")) parent = parents.get(parent);
    if (parent != null && parent.kind.equals("Return")) return true;
    if (id.isEmpty()) return false;
    for (Node n : nodes)
      if (n.range.startOffset() > allocation.range.startOffset()) {
        if (n.kind.equals("Return")
            && n.all().stream()
                .anyMatch(c -> c.kind.equals("Identifier") && c.text("symbolId").equals(id)))
          return true;
        if (n.kind.equals("Assignment")
            && n.children.size() == 2
            && n.children.get(1).kind.equals("Identifier")
            && n.children.get(1).text("symbolId").equals(id)) return true;
        if (n.kind.equals("Declaration")
            && !n.children.isEmpty()
            && n.children.getFirst().kind.equals("Identifier")
            && n.children.getFirst().text("symbolId").equals(id)) return true;
        if (n.kind.equals("Call")
            && (!FindingFactory.libraryCall(n)
                || !Set.of("free", "printf", "puts", "strcpy", "strcat", "scanf", "fgets", "memset")
                    .contains(FindingFactory.callName(n)))
            && FindingFactory.arguments(n).stream()
                .anyMatch(
                    a ->
                        a.all().stream()
                            .anyMatch(
                                c -> c.kind.equals("Identifier") && c.text("symbolId").equals(id))))
          return true;
      }
    return false;
  }

  private boolean recognizedGuard(Node n, String id, Node allocation, List<Node> nodes) {
    if (!n.kind.equals("If") || n.range.startOffset() < allocation.range.endOffset()) return false;
    Node cond = n.children.getFirst();
    boolean negative = false, positive = false;
    if (cond.kind.equals("Unary")
        && cond.text("operator").equals("!")
        && FindingFactory.symbol(cond.children.getFirst()).equals(id)) negative = true;
    if (cond.kind.equals("Identifier") && FindingFactory.symbol(cond).equals(id)) positive = true;
    if (cond.kind.equals("Binary") && Set.of("==", "!=").contains(cond.text("operator"))) {
      Node a = cond.children.get(0), b = cond.children.get(1);
      boolean matches =
          (FindingFactory.symbol(a).equals(id) && isNull(b))
              || (FindingFactory.symbol(b).equals(id) && isNull(a));
      negative = matches && cond.text("operator").equals("==");
      positive = matches && cond.text("operator").equals("!=");
    }
    boolean priorUse =
        nodes.stream()
            .anyMatch(
                c ->
                    c.kind.equals("Identifier")
                        && c.text("symbolId").equals(id)
                        && c.range.startOffset() > allocation.range.endOffset()
                        && c.range.startOffset() < n.range.startOffset());
    if (negative && !priorUse && endsWithReturn(n.children.get(1))) return true;
    if (positive) {
      Node body = n.children.get(1);
      return nodes.stream()
          .filter(
              c ->
                  c.kind.equals("Identifier")
                      && c.text("symbolId").equals(id)
                      && c.range.startOffset() > allocation.range.endOffset())
          .allMatch(
              c ->
                  (c.range.startOffset() >= n.range.startOffset()
                          && c.range.endOffset() <= body.range.endOffset())
                      || (parents.get(c) != null
                          && parents.get(c).kind.equals("Call")
                          && FindingFactory.callName(parents.get(c)).equals("free")));
    }
    return false;
  }

  private boolean isNull(Node n) {
    return (n.kind.equals("Identifier")
            && n.text("name").equals("NULL")
            && n.text("origin").equals("LIBRARY"))
        || (n.kind.equals("Literal") && n.text("value").equals("0"));
  }

  private boolean endsWithReturn(Node n) {
    if (n.kind.equals("Return")) return true;
    return n.kind.equals("Block")
        && !n.children.isEmpty()
        && n.children.getLast().kind.equals("Return");
  }

  private void largeArray(Node n, String fn) {
    Object dims = n.attributes.get("arrayDimensions");
    if (!(dims instanceof List<?> values) || values.size() != 1) return;
    try {
      long size = Long.parseLong(values.getFirst().toString());
      if (size > arrayThreshold)
        add(
            "CS-RES-004",
            "Large fixed-size array",
            "LOW",
            "HIGH",
            n,
            fn,
            n.text("symbolId"),
            "This array declares "
                + size
                + " elements, exceeding the configured "
                + arrayThreshold
                + "-element review threshold.",
            "Review the storage duration and whether this capacity is necessary.",
            "Element count is known; runtime memory use and target-dependent element sizes are not"
                + " measured.");
    } catch (NumberFormatException ignored) {
    }
  }

  private void add(
      String id,
      String name,
      String severity,
      String confidence,
      Node n,
      String fn,
      String symbol,
      String explanation,
      String remediation,
      String limit) {
    findings.add(
        factory.create(
            id,
            name,
            "RESOURCE",
            severity,
            confidence,
            n,
            fn,
            symbol,
            explanation,
            remediation,
            limit));
  }
}
