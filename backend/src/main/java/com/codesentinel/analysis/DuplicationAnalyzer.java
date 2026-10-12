package com.codesentinel.analysis;

import com.codesentinel.model.*;
import com.codesentinel.parser.ParserAdapter.LexToken;
import java.util.*;

public class DuplicationAnalyzer {
  public record Match(
      String id,
      String matchType,
      String firstFunction,
      String secondFunction,
      SourceRange firstRange,
      SourceRange secondRange,
      int tokenCount) {}

  public record Result(List<Match> matches, List<Finding> findings) {}

  private record Body(Node fn, Node body, List<LexToken> tokens, String exact, String structural) {}

  public Result analyze(Node ast, List<LexToken> tokens, FindingFactory factory) {
    List<Body> bodies = new ArrayList<>();
    for (Node fn : ast.all())
      if (fn.kind.equals("Function"))
        for (Node body : fn.children)
          if (body.kind.equals("Block")) {
            var ts =
                tokens.stream()
                    .filter(
                        t ->
                            t.channel() == 0
                                && t.range().startOffset() >= body.range.startOffset()
                                && t.range().endOffset() <= body.range.endOffset())
                    .toList();
            if (ts.size() < 30) continue;
            Map<String, String> aliases = new LinkedHashMap<>();
            List<String> normalized = new ArrayList<>();
            for (var t : ts)
              normalized.add(
                  t.category().equals("IDENTIFIER")
                      ? aliases.computeIfAbsent(t.text(), k -> "id" + aliases.size())
                      : t.text());
            bodies.add(
                new Body(
                    fn,
                    body,
                    ts,
                    String.join("\u001f", ts.stream().map(LexToken::text).toList()),
                    String.join("\u001f", normalized)));
          }
    List<Match> matches = new ArrayList<>();
    List<Finding> findings = new ArrayList<>();
    for (int i = 0; i < bodies.size(); i++)
      for (int j = i + 1; j < bodies.size(); j++) {
        Body a = bodies.get(i), b = bodies.get(j);
        String kind =
            a.exact().equals(b.exact())
                ? "EXACT_TOKENS"
                : a.structural().equals(b.structural()) ? "IDENTIFIER_RENAMING" : null;
        if (kind == null) continue;
        matches.add(
            new Match(
                "clone" + matches.size(),
                kind,
                a.fn().text("name"),
                b.fn().text("name"),
                a.body().range,
                b.body().range,
                a.tokens().size()));
        findings.add(
            factory.create(
                "CS-DUP-001",
                "Repeated function body",
                "DUPLICATION",
                "LOW",
                kind.equals("EXACT_TOKENS") ? "HIGH" : "MEDIUM",
                b.body(),
                b.fn().text("name"),
                a.fn().id,
                "This body matches "
                    + a.fn().text("name")
                    + " by "
                    + kind.toLowerCase().replace('_', ' ')
                    + ".",
                "Consider extracting shared behavior if the functions should evolve together.",
                "Only whole function bodies with at least 30 significant tokens are compared;"
                    + " structural matches do not prove equivalent behavior."));
      }
    return new Result(matches, findings);
  }
}
