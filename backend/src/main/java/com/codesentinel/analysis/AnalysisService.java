package com.codesentinel.analysis;

import com.codesentinel.model.*;
import com.codesentinel.parser.ParserAdapter;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.nio.charset.StandardCharsets;
import java.security.*;
import java.util.*;
import java.util.regex.*;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

@Service
public class AnalysisService {
  public record Module(
      String status, Object data, List<Diagnostic> diagnostics, List<String> limitations) {}

  private final ObjectMapper mapper;
  private final int arrayThreshold;

  public AnalysisService(
      ObjectMapper mapper, @Value("${codesentinel.array-threshold:1024}") int arrayThreshold) {
    this.mapper = mapper;
    this.arrayThreshold = arrayThreshold;
  }

  private Module module(
      String status, Object data, List<Diagnostic> diagnostics, String... limits) {
    return new Module(status, data, diagnostics, List.of(limits));
  }

  public Map<String, Object> analyze(String source, String filename) {
    String file = filename == null || filename.isBlank() ? "input.c" : filename.replace('\\', '/');
    file = file.substring(file.lastIndexOf('/') + 1).replaceAll("[\\p{Cntrl}]", "");
    if (file.isBlank()) file = "input.c";
    if (file.length() > 120) file = file.substring(0, 120);
    var parsed = new ParserAdapter().parse(source);
    Node ast = parsed.ast();
    String hash = hash(source);
    Map<String, Object> out = new LinkedHashMap<>(), summary = new LinkedHashMap<>();
    Map<String, Module> modules = new LinkedHashMap<>();
    out.put("schemaVersion", "1.0");
    out.put("analysisId", "a-" + hash.substring(0, 16));
    out.put(
        "sourceMetadata",
        Map.of(
            "filename",
            file,
            "language",
            "C",
            "sha256",
            hash,
            "bytes",
            source.getBytes(StandardCharsets.UTF_8).length));
    out.put("modules", modules);
    out.put("summary", summary);
    summary.put("tokenCount", parsed.tokens().stream().filter(t -> t.channel() == 0).count());
    for (String key :
        List.of(
            "functionCount",
            "totalLines",
            "securityFindings",
            "resourceWarnings",
            "optimizationCount",
            "riskScore",
            "assessedFunctions")) summary.put(key, null);
    modules.put(
        "tokens",
        module(
            parsed.valid() ? "COMPLETED" : "PARTIAL",
            parsed.tokens(),
            parsed.diagnostics(),
            "Token count excludes whitespace, comments, directives, and EOF; comments remain"
                + " inspectable."));
    List<Diagnostic> preprocessing = new ArrayList<>();
    Set<String> headers = new LinkedHashSet<>();
    for (var token : parsed.tokens())
      if (token.category().equals("DIRECTIVE")) {
        Matcher include =
            Pattern.compile(
                    "#\\s*include\\s*[<\"]([^>\"]+)[>\"]\\s*(?://.*|/\\*.*?\\*/\\s*)?",
                    Pattern.DOTALL)
                .matcher(token.text().strip());
        if (include.matches() && LibraryCatalog.HEADERS.containsKey(include.group(1)))
          headers.add(include.group(1));
        else
          preprocessing.add(
              new Diagnostic(
                  "PP-UNSUPPORTED",
                  "WARNING",
                  "Unsupported preprocessing directive.",
                  token.range(),
                  "Only four catalog headers are recognized. Macros, conditional compilation, and"
                      + " other headers are not expanded; downstream results are withheld."));
      }
    modules.put(
        "preprocessing",
        module(
            preprocessing.isEmpty() ? "COMPLETED" : "PARTIAL",
            Map.of("catalogHeaders", headers, "mode", "LIBRARY_CATALOG_NO_EXPANSION"),
            preprocessing,
            "Header files are never read; the catalog is a limited model, not a C preprocessor."));
    modules.put(
        "dataFlow",
        module(
            "NOT_IMPLEMENTED",
            null,
            List.of(),
            "Live-variable analysis is deferred. No IN/OUT sets are fabricated."));
    out.put(
        "limitations",
        List.of(
            "Static source analysis only; submitted programs are never executed.",
            "Warnings and the risk score are heuristics, not security or runtime guarantees.",
            "The parser accepts more C syntax than downstream passes model.",
            "Single-file analysis with a limited standard-library catalog; full preprocessing and C"
                + " type checking are absent."));
    if (!parsed.valid() || !preprocessing.isEmpty()) {
      String reason =
          !preprocessing.isEmpty()
              ? "Preprocessing could change this program; edit it to the supported input boundary."
              : "Fix lexical/syntax errors before downstream analysis.";
      for (String key :
          List.of(
              "ast",
              "symbols",
              "semantics",
              "security",
              "resources",
              "performance",
              "duplication",
              "tac",
              "optimization",
              "cfg",
              "risk")) modules.put(key, module("SKIPPED", null, List.of(), reason));
      out.put("status", preprocessing.isEmpty() ? "PARSE_ERROR" : "PARTIAL_ANALYSIS");
      out.put("diagnostics", combine(parsed.diagnostics(), preprocessing));
      return new ReportProjection(mapper).redact(out, ast, parsed.tokens());
    }
    var unsupported =
        ast.all().stream()
            .filter(n -> n.kind.equals("Unsupported") || n.attributes.containsKey("unsupported"))
            .map(
                n ->
                    new Diagnostic(
                        "AST-UNSUPPORTED",
                        "WARNING",
                        n.attributes.containsKey("unsupported")
                            ? n.text("unsupported")
                            : n.text("reason"),
                        n.range,
                        "Each pass reports its own supported coverage."))
            .toList();
    boolean partial = !unsupported.isEmpty();
    modules.put(
        "ast",
        module(
            partial ? "PARTIAL" : "COMPLETED",
            ast,
            unsupported,
            "This is a simplified AST converted from the ANTLR parse tree."));
    var symbols = new SymbolAnalyzer().analyze(ast, headers);
    modules.put(
        "symbols",
        module(
            partial ? "PARTIAL" : "COMPLETED",
            symbols,
            List.of(),
            "Unsupported declarations are not resolved; parser-internal symbols are separate from"
                + " this table."));
    modules.put(
        "semantics",
        module(
            partial ? "PARTIAL" : "COMPLETED",
            symbols.diagnostics(),
            symbols.diagnostics(),
            "Selected declaration and return checks only; complete C type checking and definite"
                + " assignment are not implemented."));
    var tac = new TacGenerator().generate(ast, symbols.symbols(), symbols.diagnostics());
    List<Diagnostic> irDiagnostics = tac.stream().flatMap(f -> f.diagnostics().stream()).toList();
    boolean irPartial = tac.stream().anyMatch(f -> !f.status().equals("COMPLETED"));
    modules.put(
        "tac",
        module(
            irPartial ? "PARTIAL" : "COMPLETED",
            tac,
            irDiagnostics,
            "Unsupported or semantically invalid functions expose no incomplete TAC."));
    var optimized = new Optimizer().optimize(tac, symbols.symbols());
    modules.put(
        "optimization",
        module(
            irPartial ? "PARTIAL" : "COMPLETED",
            optimized,
            optimized.diagnostics(),
            "Block-local folding/propagation for signed 32-bit integers. No dead-code elimination"
                + " or instruction-count reduction is assumed."));
    var graphs = new CfgBuilder().build(optimized.functions());
    modules.put(
        "cfg",
        module(
            irPartial ? "PARTIAL" : "COMPLETED",
            graphs,
            irDiagnostics,
            "Built from optimized TAC; disconnected/unreachable blocks remain visible."));
    FindingFactory factory = new FindingFactory(source, file);
    var security = new SecurityAnalyzer(factory).analyze(ast);
    var resources = new ResourceAnalyzer(factory, arrayThreshold).analyze(ast);
    var performance = new MetricsAnalyzer(factory).analyze(source, ast, parsed.tokens());
    var duplication = new DuplicationAnalyzer().analyze(ast, parsed.tokens(), factory);
    String coverage = partial ? "PARTIAL" : "COMPLETED";
    modules.put(
        "security",
        module(
            coverage,
            security,
            List.of(),
            "Direct catalog-library calls and simple local assignment provenance; no full taint or"
                + " exploit analysis."));
    modules.put(
        "resources",
        module(
            coverage,
            resources,
            List.of(),
            "Call-site counts and local ownership hints; alias/path analysis, use-after-free, and"
                + " exact bytes are not established."));
    modules.put(
        "performance",
        module(
            coverage,
            performance,
            List.of(),
            "Source metrics are static indicators, not execution-time or Big-O measurements."));
    modules.put(
        "duplication",
        module(
            coverage,
            duplication,
            List.of(),
            "Whole bodies of at least 30 significant tokens; exact/identifier-renaming fingerprints"
                + " only."));
    List<Finding> all = new ArrayList<>(security);
    all.addAll(resources.findings());
    all.addAll(performance.findings());
    all.addAll(duplication.findings());
    var scorer = new RiskScorer();
    all = scorer.deduplicate(all);
    var risk = scorer.score(all);
    modules.put(
        "risk",
        module(
            partial || irPartial ? "PARTIAL" : "COMPLETED",
            risk,
            List.of(),
            "Zero means no scored findings in assessed scope. Semantic errors are not included in"
                + " the review-priority score."));
    out.put("findings", all);
    out.put("unsupportedConstructs", unsupported);
    summary.put("functionCount", performance.functionCount());
    summary.put("totalLines", performance.totalLines());
    summary.put("securityFindings", security.size());
    summary.put("resourceWarnings", resources.findings().size());
    summary.put("optimizationCount", optimized.changes().size());
    summary.put("riskScore", risk.score());
    summary.put("assessedFunctions", graphs.size());
    List<Diagnostic> diagnostics = combine(unsupported, symbols.diagnostics());
    diagnostics.addAll(irDiagnostics);
    diagnostics.addAll(optimized.diagnostics());
    out.put("diagnostics", diagnostics);
    out.put(
        "status",
        partial || irPartial
            ? "PARTIAL_ANALYSIS"
            : !diagnostics.isEmpty() || !all.isEmpty() ? "SUCCESS_WITH_WARNINGS" : "SUCCESS");
    return new ReportProjection(mapper).redact(out, ast, parsed.tokens());
  }

  private List<Diagnostic> combine(List<Diagnostic> a, List<Diagnostic> b) {
    List<Diagnostic> out = new ArrayList<>(a);
    out.addAll(b);
    return out;
  }

  private String hash(String source) {
    try {
      return HexFormat.of()
          .formatHex(
              MessageDigest.getInstance("SHA-256").digest(source.getBytes(StandardCharsets.UTF_8)));
    } catch (NoSuchAlgorithmException e) {
      throw new IllegalStateException(e);
    }
  }
}
