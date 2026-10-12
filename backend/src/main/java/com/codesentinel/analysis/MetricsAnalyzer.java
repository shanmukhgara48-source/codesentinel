package com.codesentinel.analysis;

import com.codesentinel.model.*;
import com.codesentinel.parser.ParserAdapter.LexToken;
import java.util.*;

public class MetricsAnalyzer {
  public record FunctionMetrics(
      String id,
      String name,
      SourceRange range,
      int declarations,
      int branches,
      int loops,
      int maxNesting,
      int cyclomaticComplexity,
      String status) {}

  public record Result(
      int totalLines,
      int nonEmptyLines,
      int commentLines,
      long functionCount,
      long declarationCount,
      long branchCount,
      long loopCount,
      int maxNesting,
      List<FunctionMetrics> functions,
      List<Finding> findings) {}

  private final FindingFactory factory;
  private final List<Finding> findings = new ArrayList<>();

  public MetricsAnalyzer(FindingFactory factory) {
    this.factory = factory;
  }

  public Result analyze(String source, Node ast, List<LexToken> tokens) {
    String[] lines = source.split("\\r\\n|\\n|\\r", -1);
    int physical = lines.length - (source.endsWith("\n") || source.endsWith("\r") ? 1 : 0);
    physical = Math.max(1, physical);
    Set<Integer> comments = new HashSet<>();
    for (var t : tokens)
      if (t.category().equals("COMMENT"))
        for (int l = t.range().line(); l <= t.range().endLine(); l++) comments.add(l);
    List<FunctionMetrics> functions = new ArrayList<>();
    for (Node fn : ast.all())
      if (fn.kind.equals("Function")) {
        var all = fn.all();
        int branches = (int) all.stream().filter(n -> n.kind.equals("If")).count(),
            loops =
                (int)
                    all.stream()
                        .filter(n -> Set.of("For", "While", "DoWhile").contains(n.kind))
                        .count();
        int logical =
            (int)
                all.stream()
                    .filter(
                        n ->
                            n.kind.equals("Binary")
                                && Set.of("&&", "||").contains(n.text("operator")))
                    .count();
        int depth = nesting(fn, 0, fn.text("name"));
        functions.add(
            new FunctionMetrics(
                fn.id,
                fn.text("name"),
                fn.range,
                (int) all.stream().filter(n -> n.kind.equals("Declaration")).count(),
                branches,
                loops,
                depth,
                1 + branches + loops + logical,
                all.stream().anyMatch(n -> n.kind.equals("Unsupported"))
                    ? "PARTIAL"
                    : "COMPLETED"));
      }
    return new Result(
        physical,
        (int) Arrays.stream(lines).filter(l -> !l.isBlank()).count(),
        comments.size(),
        functions.size(),
        ast.all().stream().filter(n -> n.kind.equals("Declaration")).count(),
        functions.stream().mapToInt(FunctionMetrics::branches).sum(),
        functions.stream().mapToInt(FunctionMetrics::loops).sum(),
        functions.stream().mapToInt(FunctionMetrics::maxNesting).max().orElse(0),
        functions,
        findings);
  }

  private int nesting(Node n, int depth, String fn) {
    boolean control = Set.of("If", "For", "While", "DoWhile").contains(n.kind);
    int here = depth + (control ? 1 : 0), max = here;
    if (Set.of("For", "While", "DoWhile").contains(n.kind) && containsLoop(n))
      findings.add(
          factory.create(
              "CS-PERF-001",
              "Nested loop structure",
              "PERFORMANCE",
              "LOW",
              "HIGH",
              n,
              fn,
              "",
              "A loop contains another loop in its syntax tree.",
              "Review bounds and whether repeated work can be reduced.",
              "Nesting does not establish Big-O complexity without bounds and data dependencies."));
    if (control && here > 4)
      findings.add(
          factory.create(
              "CS-PERF-002",
              "Deep control nesting",
              "PERFORMANCE",
              "LOW",
              "HIGH",
              n,
              fn,
              "",
              "Control nesting exceeds four levels.",
              "Consider extracting a function or using early returns to improve readability.",
              "This is a source structure indicator, not a measured runtime problem."));
    for (Node c : n.children) max = Math.max(max, nesting(c, here, fn));
    return max;
  }

  private boolean containsLoop(Node n) {
    return n.children.stream()
        .anyMatch(
            c ->
                c.all().stream().anyMatch(x -> Set.of("For", "While", "DoWhile").contains(x.kind)));
  }
}
