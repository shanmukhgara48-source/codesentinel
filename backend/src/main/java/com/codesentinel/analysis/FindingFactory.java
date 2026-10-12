package com.codesentinel.analysis;

import com.codesentinel.model.*;
import java.util.*;

public class FindingFactory {
  private final String source, filename;

  public FindingFactory(String source, String filename) {
    this.source = source;
    this.filename = filename;
  }

  public Finding create(
      String rule,
      String name,
      String domain,
      String severity,
      String confidence,
      Node node,
      String function,
      String symbol,
      String explanation,
      String remediation,
      String limitation) {
    int start = Math.max(0, Math.min(node.range.startOffset(), source.length())),
        end = Math.min(source.length(), node.range.endOffset());
    int lineStart = source.lastIndexOf('\n', Math.max(0, start - 1)) + 1,
        lineEnd = source.indexOf('\n', end);
    if (lineEnd < 0) lineEnd = source.length();
    // Redact complete literals before the public projection shortens excerpts.
    String excerpt = source.substring(lineStart, lineEnd).strip();
    return new Finding(
        rule + ":" + start + ":" + symbol,
        rule,
        name,
        domain,
        severity,
        confidence,
        filename,
        function,
        symbol,
        node.range,
        excerpt,
        explanation,
        remediation,
        List.of(limitation));
  }

  public static String callName(Node n) {
    return n.kind.equals("Call")
            && !n.children.isEmpty()
            && n.children.getFirst().kind.equals("Identifier")
        ? n.children.getFirst().text("name")
        : "";
  }

  public static boolean libraryCall(Node n) {
    return n.kind.equals("Call")
        && !n.children.isEmpty()
        && n.children.getFirst().text("origin").equals("LIBRARY");
  }

  public static List<Node> arguments(Node n) {
    return n.children.size() > 1 ? n.children.subList(1, n.children.size()) : List.of();
  }

  public static String symbol(Node n) {
    if (n.kind.equals("Identifier")) return n.text("symbolId");
    if (n.kind.equals("Unary") && n.text("operator").equals("&") && !n.children.isEmpty())
      return symbol(n.children.getFirst());
    return "";
  }
}
