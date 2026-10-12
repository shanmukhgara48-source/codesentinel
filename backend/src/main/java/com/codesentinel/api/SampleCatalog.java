package com.codesentinel.api;

import java.io.*;
import java.nio.charset.StandardCharsets;
import java.util.*;
import org.springframework.core.io.ClassPathResource;
import org.springframework.stereotype.Component;

@Component
public class SampleCatalog {
  public record Sample(String id, String name, String purpose, String source) {}

  private static final List<String[]> ENTRIES =
      List.of(
          new String[] {
            "hero",
            "Full pipeline",
            "Compiler trace, string risks, branch, loop, checked allocation."
          },
          new String[] {"arithmetic", "Constant arithmetic", "Folding and propagation produce 20."},
          new String[] {
            "scopes", "Scopes & shadowing", "Distinct symbols and compatible prototypes."
          },
          new String[] {
            "strings", "String input audit", "Input, strcpy, and an input-derived command."
          },
          new String[] {
            "bounded", "Bounded input", "Bounded conversion without an unbounded-input warning."
          },
          new String[] {"secrets", "Placeholder credential", "Fake credential and redaction."},
          new String[] {"loops", "Nested loops", "Back edges, nesting, complexity."},
          new String[] {
            "resources", "Resource patterns", "Checked, unguarded, escaping, and loop allocations."
          },
          new String[] {
            "duplicates", "Repeated functions", "Whole-body exact and identifier-renaming matches."
          },
          new String[] {
            "syntax-error", "Syntax error", "Located errors without downstream results."
          },
          new String[] {
            "unsupported", "Unsupported control", "switch parses but has no fabricated TAC."
          },
          new String[] {
            "macros", "Unsupported preprocessing", "A macro withholds downstream results."
          });

  public List<Sample> all() {
    List<Sample> result = new ArrayList<>();
    for (String[] entry : ENTRIES)
      try (var stream = new ClassPathResource("samples/" + entry[0] + ".c").getInputStream()) {
        result.add(
            new Sample(
                entry[0],
                entry[1],
                entry[2],
                new String(stream.readAllBytes(), StandardCharsets.UTF_8)));
      } catch (IOException e) {
        throw new IllegalStateException("Packaged sample unavailable.", e);
      }
    return result;
  }
}
