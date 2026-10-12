# CodeSentinel code review and fixes

Review date: 12 October 2026. This review covered the application API, parser adapter and AST conversion, educational symbols, TAC, optimizer, CFG, security/resource/metric/duplication passes, report projection, React views, setup/start/test scripts, dependencies, tests, samples, documentation, and vendored parser provenance. Generated build output was verified by rebuilding. Upstream grammar and vendor originals were preserved.

## Blockers fixed

- **Long credential excerpts leaked a value.** Finding excerpts were shortened before redaction, so the full literal could no longer match. Complete excerpts are now redacted before their public copy is shortened. A regression checks the entire returned JSON for the leaked prefix.
- **Deep expressions broke JSON responses.** A valid chain of 600 additions could build a tree too deep to serialize, producing an invalid response. Iterative grammar/AST depth checks reject excessive trees; parser stack exhaustion becomes a structured input error. Tests also check that the next ordinary request succeeds.
- **Octal integers were treated as decimal.** `010 + 1` incorrectly became `return 11`. Octal arithmetic is now withheld under the existing decimal-only arithmetic profile. No incorrect folded result is published.
- **Pointer-valued elements were treated as integers.** Dereferencing `int **` or indexing an array of `int *` could enter signed integer arithmetic. Element checks now account for pointer depth and array dimensions; unsupported pointer arithmetic is withheld. Ordinary `int *` loads remain supported.
- **Persistent storage was lowered like an ordinary local.** A static local initializer was emitted as though it ran on each invocation. TAC is now withheld for static and thread-local local declarations because persistent lifetime is outside the model.
- **Wider integer arithmetic entered the signed-int profile.** Decimal constants above `INT_MAX` could be marked integer-safe. Such operands are now excluded from supported signed-int arithmetic.

## Quick wins fixed

- **Valid returns received semantic errors.** `void *f(){return 0;}` and `static void f(){return;}` now distinguish pointer return types and storage/function qualifiers. A missing value from a pointer-returning function still receives a diagnostic.
- **Block prototypes leaked into global scope.** Function signature registration now distinguishes top-level declaration groups and local prototypes. A prototype inside a nested block cannot resolve a call outside that block.
- **Prototype signatures lost information.** Empty `()` prototypes are recognized as functions, and simple unnamed pointer parameters retain their pointer depth. Complex unnamed declarators are disclosed as unsupported.
- **Finding categories were wrong.** Structure and duplication findings were grouped under Resources. The diagnostics view now derives category from the backend domain and provides Performance and Duplication filters. A browser regression verifies both categories.
- **Chart tooltip text had poor contrast.** Complexity tooltip text now uses the dark text color of the light interface.
- **Startup could mix different services.** The packaged start command now checks ports before launching, preventing a new frontend from accidentally using an already running backend.
- **Documentation described an older UI and coverage.** The architecture now names CodeMirror, limitations describe the new bounds and arithmetic scope, and score documentation correctly says the detailed contributions are available in JSON rather than the current light Overview. A fallback label prevents new Markdown documents from appearing unnamed in the documentation component.

## Verification

`CI=1 ./scripts/test.sh` passed 73 backend JUnit/MockMvc tests, a production frontend build, and 11 Playwright browser cases against the real Java backend. Three cases repeat the complete demo journey in fresh browser contexts. Responsive cases cover 320, 768, and 1440 pixels. Vendor checksum verification passed.

The reviewed packaged Java application and built frontend were also started for local checks. A second startup is refused when the ports are occupied. Public repository preparation excludes dependency folders, build output, local environment files, private keys, logs, and document render intermediates. The deliberately fake credential fixture is retained for teaching.

A GitHub Actions workflow installs dependencies and runs the same verification on pushes and pull requests. Local success does not establish that GitHub-hosted CI has run successfully; its result must be checked separately.

## Nice to have and known limits

The product guide and analysis limitations document distinguish supported implementation from deferred work. Full C type checking, preprocessing, alias/path/interprocedural analysis, general ownership proof, live-variable analysis, DCE, and CSE remain deferred. No classroom-hardware trial or browser engine other than Chromium was performed in this review. Warnings and review scores are heuristic evidence. Passing tests and a broad review cannot prove that every possible bug has been removed.
