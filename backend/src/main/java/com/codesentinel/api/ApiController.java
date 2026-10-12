package com.codesentinel.api;

import com.codesentinel.analysis.AnalysisService;
import java.nio.charset.StandardCharsets;
import java.util.*;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api")
public class ApiController {
  private final AnalysisService service;
  private final SampleCatalog catalog;

  public ApiController(AnalysisService service, SampleCatalog catalog) {
    this.service = service;
    this.catalog = catalog;
  }

  public record Request(String source, String filename) {}

  @GetMapping("/health")
  public Map<String, Object> health() {
    return Map.of(
        "success",
        true,
        "data",
        Map.of(
            "application",
            "CodeSentinel",
            "parser",
            "ANTLR C",
            "antlrVersion",
            "4.13.2",
            "grammarCommit",
            "8c7680c4d28a2c84c8a1077a8b3dad4b37b300df",
            "javaVersion",
            System.getProperty("java.version")));
  }

  @GetMapping("/samples")
  public Map<String, Object> samples() {
    return Map.of("success", true, "data", catalog.all());
  }

  @PostMapping("/analyze")
  public Map<String, Object> analyze(@RequestBody Request request) {
    if (request.source() == null || request.source().isBlank())
      throw new IllegalArgumentException("Enter a C program before analyzing.");
    if (request.source().getBytes(StandardCharsets.UTF_8).length > 65536)
      throw new OversizedInput();
    return Map.of("success", true, "data", service.analyze(request.source(), request.filename()));
  }

  public static class OversizedInput extends RuntimeException {}
}
