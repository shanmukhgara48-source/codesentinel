# CodeSentinel review report

Review date: 12 October 2026. The existing checkout was clean before this review. The review inspected the parser and support boundary, AST conversion, symbol/scoping checks, TAC, optimization, CFG, findings, report redaction, API, frontend, tests, scripts, samples, documentation, and CI. The established light gray, white, black, and violet identity was preserved.

## Priorities and completed work

🔴 **Correctness blockers.** New tests first reproduced disappearing discarded volatile reads, findings/resource counts from unevaluated sizeof calls, global signature errors that still published dependent TAC, and invalid scalar calls/targets. Fixes retain explicit volatile READs, exclude unevaluated call sites and releases, withhold TAC dependent on global semantic errors, and reject unsupported/invalid scalar and memory targets. Qualified pointer declarators are disclosed instead of losing qualifiers. A conservative explicit-return-path check withholds uncertain non-void fall-through; main fall-through is represented as return 0. Binary AST ranges now end at their own operand.

🟡 **Educational foundation.** Schema 1.1 adds typed operand/output metadata, AST origin IDs, and explicit scalar uses, definite/possible writes, memory, call, volatile, and trap effects. Metadata is rebuilt after rewrites. Array addresses are separated from scalar values, and a declaration is not labeled an observable volatile write. This foundation supports bounded live variables and reaching definitions on original TAC with independently checked equations, joins, loop convergence, unreachable paths, and iteration traces. Unknown and uninitialized definitions remain labeled. No advanced optimizer was added.

🟡 **Product reliability and inspection.** AST source connections link tokens, references, TAC, and CFG. Instructions expose their operands/effects and source. CFG depth layout, side routes, unreachable markers, fit/zoom/pan, a block selector, and incoming/outgoing navigation support inspection. Tab lists support arrow keys and Home/End; focus is visible and reduced motion is respected. Failed, unreadable, and timed-out requests provide recovery states and block export until recovery. HTTP method/media-type failures keep their proper status and JSON envelope.

🟡 **Measured rendering bottleneck.** A local 150-function fixture produced 2,250 token rows and over 16,000 DOM nodes in the unpaged token view. Shared tables now render at most 100 rows with next/previous controls. A repeat probe showed 100 rows and about 1,300 DOM nodes; the browser regression checks the bound and next page. This is a local rendering observation, not a C execution benchmark or generalized runtime speed claim. CFG layout is memoized; large canvases preserve access through the block inspector.

🟡 **Documentation and demo.** README, architecture, concepts, rules, limits, product/Word guide, faculty/viva guides, and verification reflect final behavior. Actual production UI screenshots and a reproducible capture script are included. Browser tests now use the packaged Java application and production frontend.

## Existing work retained

The prior foundation’s checked signed-int folding, short-circuit branches, nested break/continue targets, scope fixes, long-credential redaction, parser limits/recovery, pinned grammar provenance, and local startup guards remain covered. No submitted C is executed. No additional runtime dependency was introduced.

## Verification

See VERIFICATION for final test counts and publication evidence. Regressions include equation checks on a loop/branch graph, both branch definitions at a join, unreachable writes, uncertain call writes preserving alternatives, budget refusal, source IDs/ranges, volatile behavior, invalid targets, and unevaluated operations. Production browser cases cover three complete fresh-context rehearsals, API errors/recovery, stale/superseded results, source connections, traces, large tables, keyboard escape/navigation, reduced motion, and responsive layouts.

## Remaining work

🟢 **Future extensions.** Precise memory/alias data flow, full C types and preprocessing, interprocedural/path-sensitive analysis, and verified DCE/CSE require separate design and tests. Current fixed points do not authorize those transformations. Warnings remain heuristics. Other browser engines and classroom hardware need rehearsal. The client timeout does not cancel server work. Passing the suite verifies these cases; it does not establish that the tool is flawless.
