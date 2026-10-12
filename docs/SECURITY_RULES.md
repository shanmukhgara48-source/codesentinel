# CodeSentinel analysis rules

Findings are static review hints, with stable rule IDs, severity, confidence, source range, excerpt, explanation, remediation, and limitations. A warning does not establish exploitability. The Java implementation is under `backend/src/main/java/com/codesentinel/analysis`.

## Security rules

`SecurityAnalyzer.visit` inspects Call AST nodes whose callee resolves to a catalog LIBRARY symbol. Comments and strings mentioning APIs do not become calls. Source-defined functions sharing a library name replace the catalog entry and do not automatically receive library findings.

| Rule | Pattern | Severity / confidence | Detection and suggested action |
|---|---|---|---|
| CS-SEC-001 | `gets` | High / High | Direct call with no destination bound. Replace with fgets and validate the result. |
| CS-SEC-002 | `strcpy` | Medium / Medium | Direct call lacking a capacity argument. Review input length and use an explicit-capacity operation. |
| CS-SEC-003 | `strcat` | Medium / Medium | Same capacity review for concatenation. |
| CS-SEC-004 | `sprintf` | Medium / Medium | Same capacity review for formatting; prefer bounded output with truncation checks. |
| CS-SEC-005 | Unbounded literal-format string input | High / High | `scanf`, `sscanf`, or `fscanf` format contains an unsuppressed `%s` or `%[` without a usable width. Set a width below buffer capacity or use fgets. |
| CS-SEC-006 | Input-derived `system` argument | High / Medium | Simple local input-destination/identifier-assignment provenance reaches system. Avoid untrusted shell command text. |
| CS-SEC-007 | Unknown `system` provenance | Informational / Low | Argument origin cannot be established; review it manually. A literal constant produces no injection warning. |
| CS-SEC-008 | Credential-like name assigned a string literal | Medium / Low | Name includes password, passwd, pwd, api_key/apikey, secret, or token. Review placeholder versus real credential and move real values into runtime configuration. |

`unboundedString` scans escaped percent signs, suppression, field widths, and length modifiers. `%%s`, `%*s`, and `%15s` do not trigger the unbounded `%s` rule. The rule concerns that conversion only; bounded input still requires correct capacity and return-value checks. Scansets use the same width/suppression check; dynamic formats have no dedicated capacity rule.

Provenance is limited to the same function and simple assignments; control-flow boundaries and opaque effects lose uncertain classifications. This is not a full taint analysis. No assertion is made about whether a shell executes, whether input is malicious, or whether a library call overflows a particular buffer.

`secretName`, `decode`, and `ReportProjection.redact` identify/redact suspect string values across response tokens, AST attributes, instructions, excerpts, and diagnostics. The editor keeps the original text. A fake placeholder can match; unlabeled or computed credentials can be missed.

## Resource rules

`ResourceAnalyzer.analyze` counts malloc/calloc/realloc/free source sites. Assignment, resolved symbols, simple early-return/positive guards, visible later free calls, and escape hints inform the following patterns.

| Rule | Pattern | Severity / confidence | Limitation and action |
|---|---|---|---|
| CS-RES-001 | No recognized allocation-failure guard | Medium / Low | Detector can miss alternative checks. Check allocation before use. |
| CS-RES-002 | No visible local release | Medium / Low | Alias/path behavior is unknown; absence of a recognized free is not proof of a leak. Review ownership. |
| CS-RES-003 | Allocation in a repeated loop region | Low / High | Body, condition, and update sites repeat; for initialization is excluded. Review reuse. Counts are sites, not runtime events. |
| CS-RES-004 | Fixed array exceeds threshold | Low / High | Default 1,024 elements, not bytes. Review capacity/storage duration. |

Returned, simply aliased, or externally passed allocations are classified escaped/unknown. Realloc is counted and marked ownership unknown; no ownership conclusion is inferred from a realloc call count. A recognized guard or later free does not prove correctness on every path. Use-after-free and general leak detection are deferred.

Override the threshold at backend startup with Spring property `codesentinel.array-threshold`, for example environment variable `CODESENTINEL_ARRAY_THRESHOLD=2048` before `start.sh`.

## Structure and duplication rules

| Rule | Pattern | Severity / confidence | Implementation |
|---|---|---|---|
| CS-PERF-001 | A loop contains another loop | Low / High | `MetricsAnalyzer.nesting`; no Big-O or execution-time claim |
| CS-PERF-002 | Control nesting exceeds four | Low / High | `MetricsAnalyzer.nesting`; a readability indicator |
| CS-DUP-001 | Repeated whole function body | Low / High for exact, Medium for identifier-renaming | `DuplicationAnalyzer.analyze`; at least 30 significant tokens, operators/literals preserved |

Identifier-renaming matches consistently number identifiers in first-use order. They are structural matches, not a semantic equivalence proof or invented similarity percentage.

## Review-priority score

`FindingFactory.create` constructs the finding identity from rule, source range, and affected symbol; `RiskScorer.deduplicate` keeps one finding per identity. Scoring includes security, resource, structure, and duplication findings:

```text
severity weights: Critical 25, High 15, Medium 8, Low 3, Informational 0
confidence multipliers: High 1, Medium 0.75, Low 0.5
score = min(100, round(sum(weight × multiplier)))
```

The exported JSON includes each contribution and rounded/capped per-function totals. The current light UI focuses on findings and stage coverage; it does not expose the score contribution panel. Parse failures have no score. Partial analysis carries a coverage warning. Zero means no scored finding in the assessed scope, not a secure or correct program.

The hero has High/High unbounded scanf (15 points) and Medium/Medium strcpy (6 points), producing **21**. The fake credential fixture’s Medium/Low finding contributes **4**. These observations are generated and verified from the fixtures, not embedded response objects.
