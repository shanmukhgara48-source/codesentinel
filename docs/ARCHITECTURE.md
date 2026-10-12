# CodeSentinel architecture

A single request generates all analysis stages. Java owns parsing and analysis; React presents the returned artifacts. There is no database or execution service.

## Data flow

```text
React CodeMirror editor → POST /api/analyze
  → size validation
  → ParserAdapter: tokens + syntax errors + AstBuilder
  → preprocessing boundary
  → SymbolAnalyzer: scopes, references, selected semantics
  → TacGenerator → Optimizer → CfgBuilder
  → SecurityAnalyzer + ResourceAnalyzer + MetricsAnalyzer + DuplicationAnalyzer
  → RiskScorer → ReportProjection
  → schema 1.0 JSON → React views / JSON download
```

`AnalysisService.analyze` coordinates these passes. Unsupported preprocessing or syntax errors withhold downstream results. Unsupported AST nodes mark relevant coverage partial. `TacGenerator.generate` withholds an entire unsupported or semantically invalid function’s IR instead of publishing a misleading fragment. The CFG includes only functions with published TAC.

## Module responsibilities

| Class or component | Responsibility |
|---|---|
| `api/ApiController` | Three API endpoints, request source-size validation |
| `api/ApiErrors` | Consistent 400/413/500 error envelopes |
| `api/SampleCatalog` | Loads bundled C fixture resources |
| `parser/ParserAdapter.parse` | In-memory character/token streams, limits, diagnostics, parse boundary |
| `parser/AstBuilder` | Explicit parse-tree-to-Node conversion |
| `parser/generated/CParserBase` | Upstream context-sensitive parser disambiguation; internal symbol information |
| `analysis/SymbolAnalyzer` | Application symbol IDs, scopes, resolved references, selected semantic checks |
| `analysis/TacGenerator` | Supported structured IR and control-flow lowering |
| `analysis/Optimizer` | Checked folding and block-local propagation; actual rewrite log |
| `analysis/CfgBuilder` | Basic blocks and typed edges from optimized IR |
| `analysis/SecurityAnalyzer` | Direct catalog call rules, local provenance, credential-name heuristic |
| `analysis/ResourceAnalyzer` | Source-site counts and bounded ownership/guard hints |
| `analysis/MetricsAnalyzer` | Lines, declarations, decisions, nesting, function complexity |
| `analysis/DuplicationAnalyzer` | Whole-function normalized-token fingerprints |
| `analysis/RiskScorer` | Deduplication and transparent severity/confidence contributions |
| `analysis/ReportProjection` | Final deep redaction of suspect literal values |
| `frontend/src/main.jsx` | API lifecycle, source state, stale protection, navigation, export |
| `frontend/src/compiler.jsx` | Compiler stages, filters, function choice, TAC/rewrites |
| `frontend/src/graphs.jsx` | AST inspector and selectable SVG CFG |
| `frontend/src/views.jsx` | Dashboard, charts, analysis views, reports/help |
| `frontend/src/ui.jsx` | Shared panels, statuses, source-linked diagnostics/findings |

Java paths in this table are relative to `backend/src/main/java/com/codesentinel`.

## Data contracts

`model/Node` is the application AST: deterministic ID, kind, source range, attributes, and children. `SourceRange` uses one-based line/column numbers plus UTF-16 start/end offsets, with an exclusive end. Tokens, symbols, references, findings, and instructions retain a source range. IDs derive from traversal/token positions and are stable for unchanged source.

`model/Instruction` stores opcode, result, arguments, operator, branch targets, range, integer-safety profile, and rendered text. The optimizer transforms these records; it does not edit rendered strings to implement semantics.

`AnalysisService.Module` exposes `status`, `data`, `diagnostics`, and `limitations`. Status values are COMPLETED, PARTIAL, SKIPPED, FAILED, or NOT_IMPLEMENTED; unavailable `data` is null. The current implementation uses COMPLETED/PARTIAL/SKIPPED/NOT_IMPLEMENTED in normal responses. Unexpected exceptions produce HTTP 500 instead of inventing failed-stage outputs.

The top-level result contains schema/version identity, source metadata, overall status, module results, summary, findings, diagnostics, unsupported constructs, and limitations. Statuses currently emitted are SUCCESS, SUCCESS_WITH_WARNINGS, PARSE_ERROR, and PARTIAL_ANALYSIS. Internal failures use the API error envelope. Deferred data flow does not force every otherwise complete request into partial status.

## Request lifecycle

The UI tracks an analysis sequence and an AbortController. Editing or starting a new request invalidates older responses. Results remain inspectable after edits, with a stale banner; export and source navigation are disabled until reanalysis. The source editor retains original values. Export serializes the received response rather than submitting a second analysis.

`ReportProjection` runs after all analysis so redaction does not alter the values used by rules or optimization. JSON excludes raw source, but artifacts naturally contain selected source text; suspected credential literal values are scrubbed from all projected strings. This is a heuristic privacy measure with the limits described in ANALYSIS_LIMITATIONS.

## Local operation and provenance

Both services bind to 127.0.0.1. Analysis reads no installed headers, writes no submitted source, launches no native tools, and produces no machine code. Reading bundled samples and build-time Maven grammar generation are separate from request analysis.

The pinned grammar and Java parser-support sources are retained in `backend/vendor/c`. The production lexer base replaces native preprocessing with direct in-memory input. THIRD_PARTY describes adaptations and checksums. Parser-internal symbols never become the public educational table.
