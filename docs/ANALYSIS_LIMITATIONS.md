# CodeSentinel analysis limitations

CodeSentinel explains a bounded static analysis of single-file laboratory C. The parser recognizes more syntax than the application interprets. Module status and limitations define the assessed scope for each response.

## Parsing and semantics

Syntax recognition establishes that the selected grammar recognized the token sequence. It does not establish full C semantic correctness, target compatibility, successful compilation, or defined behavior. The educational table checks undeclared uses, selected duplicate declarations/definitions, supported function signatures, and value/no-value returns. It lacks full type compatibility, promotions, definite assignment, linkage/storage analysis, complete redeclaration rules, and missing-return-path analysis.

Only four standard-header names are modeled by a small function/type/NULL catalog. Actual headers are not read. Macro expansion, conditional compilation, and other includes withhold downstream analysis. Structs, unions, switch, goto, typedef-dependent constructs, compiler extensions, and complex declarators can parse but have limited/unsupported downstream coverage.

Primitive declarations, simple pointer declarations, and one-dimensional fixed positive decimal array sizes are represented. Dynamic, computed, zero-sized, and multiple array dimensions are outside the first TAC subset. Catalog functions are names with external models, not full compiler-grade prototypes.

## TAC and optimization

TAC is an educational representation, not executable machine code. Integer arithmetic uses a signed 32-bit profile with unsuffixed decimal operands in range. Octal, hexadecimal, suffixed, and wider integer arithmetic is withheld. Persistent local storage (static or thread-local variables) is outside the TAC lifetime model and is withheld. Pointer arithmetic, mixed/floating arithmetic transformations, unsupported casts/conversions, indirect calls, and side-effecting arithmetic/call-argument expressions are withheld. Repeated assignment-target writes and side effects combined with computed memory assignment targets are also withheld rather than assigned an arbitrary order. Simple LOAD/STORE/address instructions retain effects, but do not model general aliases, target byte layout, or pointer safety. `element_address` uses logical element indexing. `sizeof` is symbolic and does not evaluate its operand or infer a target size.

Short-circuit logic and loop targets are modeled. Unsupported or semantically invalid functions publish no partial instruction stream; other functions can still be analyzed. Constant propagation is restricted to a basic block with conservative barriers; no assumptions cross branch joins or loop iterations. Volatile/addressed symbols do not receive ordinary constant bindings. Folding refuses signed overflow and division by zero.

Folding and propagation may simplify instructions without removing them. Displayed before/after counts are actual operational counts excluding DECLARE/LABEL metadata. DCE, CSE, general interprocedural optimization, and live-variable fixed-point analysis remain deferred. CFG disconnected blocks remain visible.

## Security and credential handling

Unsafe API use is a warning, not a confirmed vulnerability. Copying a short literal with strcpy can be safe and still trigger the capacity review rule. A bounded scanf conversion avoids one rule but does not prove buffer safety. Format scanning does not establish all C conversion semantics or scanset capacity safety.

System provenance tracks simple local inputs/assignments and loses uncertainty at control/effect boundaries. It does not establish all flows, validation, exploitability, or interprocedural provenance. No shell command is executed.

Credential detection relies on a name and directly assigned literal. It can match placeholders and miss unnamed, assembled, numeric, or dynamically obtained secrets. Redaction removes suspected values from the projected analysis/export, not the source editor or intentionally bundled fake sample. Raw source is omitted from the analysis response, but artifacts contain selected lexemes/excerpts. Arbitrary secrets outside the heuristic are not guaranteed to be removed. Source hashes and display metadata remain in the report.

## Resources and performance

Allocation/free counts are source sites, not runtime events. A visible later free can occur on an unrelated path, and a recognized local null guard may not establish global safety. Aliased, returned, or externally passed results are escaped/unknown. Realloc ownership is unknown. General leak, double-free, use-after-free, path-sensitive ownership, and exact runtime memory analysis are absent.

The array threshold is **elements**, not bytes; target type sizes and storage duration are not fully established. Control nesting and cyclomatic complexity are syntax metrics. Complexity is 1 + each assessed if, loop, &&, and || decision; it is not measured execution time or inferred Big-O. Unsupported control flow marks function coverage partial.

Physical/non-empty/comment-containing lines and declarations count source structure. Comment-containing lines can overlap code-containing lines. A trailing newline does not add a physical line. Nested-loop warnings do not assert a particular iteration count.

## Duplication and scoring

Whole function bodies with at least 30 significant tokens are compared. Small fragments and approximate/semantic clones are not searched. Consistent identifier renaming preserves token structure, operators, and literals; it does not establish semantic equivalence or distinguish every name-binding relationship.

The review-priority score is a transparent severity/confidence heuristic capped at 100. It is not a vulnerability probability, security grade, compiler correctness grade, or performance benchmark. Parse errors have unavailable values instead of zero. A partial result’s score describes only assessed findings.

## Operation boundary

Analysis runs in memory on localhost, with limits of 64 KiB source, 10,000 significant tokens, 128 delimiter levels, 512 grammar-tree levels, and 128 AST levels. Deep expressions receive a structured input error before analysis artifacts are serialized. It does not compile/execute C, launch a native preprocessor, read include files, or write submitted programs. There is no authentication, durable persistence, history, or production deployment. Dependency installation/build/test services are separate from request analysis.

The UI uses CodeMirror with syntax highlighting, line numbers, undo/redo, and matching brackets. It does not provide a full IDE or C debugger. Stale results are visible but export/source links are disabled until reanalysis. Automated browser verification covers Chromium; other browsers and real classroom hardware still require a local rehearsal. Initial installation needs network access; the built local demo runs without it.
