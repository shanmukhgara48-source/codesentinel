package com.codesentinel.analysis;

import com.codesentinel.model.*;
import com.codesentinel.parser.ParserAdapter.LexToken;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.util.*;
import java.util.regex.*;

/** Original values are analyzed; redaction is applied only to public DTOs. */
public class ReportProjection {
  private final ObjectMapper mapper;

  public ReportProjection(ObjectMapper mapper) {
    this.mapper = mapper;
  }

  public Map<String, Object> redact(Map<String, Object> report, Node ast, List<LexToken> tokens) {
    Set<String> values = new LinkedHashSet<>();
    if (ast != null)
      for (Node n : ast.all()) {
        boolean secret =
            n.kind.equals("Declaration") && SecurityAnalyzer.secretName(n.text("name"));
        if (n.kind.equals("Assignment") && n.children.size() > 1)
          secret = SecurityAnalyzer.secretName(n.children.getFirst().text("name"));
        if (secret)
          for (Node literal : n.all())
            if (literal.kind.equals("Literal") && literal.text("literalType").equals("string")) {
              values.add(literal.text("value"));
              for (var t : tokens)
                if (t.category().equals("STRING")
                    && t.range().startOffset() >= literal.range.startOffset()
                    && t.range().endOffset() <= literal.range.endOffset()) values.add(t.text());
            }
      }
    boolean candidate = false;
    for (var t : tokens) {
      if (t.category().equals("IDENTIFIER") && SecurityAnalyzer.secretName(t.text()))
        candidate = true;
      if (candidate && t.category().equals("STRING")) values.add(t.text());
      if (t.text().equals(";") || t.text().equals("}")) candidate = false;
      if (t.category().equals("DIRECTIVE")
          && Pattern.compile("(?i)(password|passwd|pwd|api_?key|secret|token)")
              .matcher(t.text())
              .find()) {
        Matcher m = Pattern.compile("\"(?:\\\\.|[^\"\\\\])*\"").matcher(t.text());
        while (m.find()) values.add(m.group());
      }
    }
    @SuppressWarnings("unchecked")
    Map<String, Object> raw = mapper.convertValue(report, Map.class);
    @SuppressWarnings("unchecked")
    Map<String, Object> projected =
        (Map<String, Object>)
            scrub(
                raw,
                values.stream()
                    .filter(v -> !v.equals("\"\""))
                    .sorted(Comparator.comparingInt(String::length).reversed())
                    .toList());
    return projected;
  }

  private Object scrub(Object value, List<String> secrets) {
    if (value instanceof String text) {
      for (String secret : secrets) text = text.replace(secret, "\"[REDACTED]\"");
      return text;
    }
    if (value instanceof Map<?, ?> map) {
      Map<String, Object> out = new LinkedHashMap<>();
      map.forEach((k, v) -> {
        Object clean = scrub(v, secrets);
        if (k.toString().equals("excerpt") && clean instanceof String text && text.length() > 220)
          clean = text.substring(0, 220);
        out.put(k.toString(), clean);
      });
      return out;
    }
    if (value instanceof List<?> list) return list.stream().map(v -> scrub(v, secrets)).toList();
    return value;
  }
}
