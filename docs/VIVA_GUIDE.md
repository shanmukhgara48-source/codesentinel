# CodeSentinel viva guide

Demonstrate one real C program through the Java analysis pipeline, then explain why each representation exists. Use the default Full pipeline fixture and keep `arithmetic.c` ready for the clearest optimization example.

## One-minute introduction

“CodeSentinel is an explainable static analysis workbench for laboratory C programs. React sends one source file to Java. ANTLR performs lexical and syntax analysis, and our adapter converts the parse tree into a simpler AST. Our Java passes resolve symbols, perform selected semantic checks, generate TAC, apply constant folding and propagation, and construct a control-flow graph. Other passes report unsafe-library-call patterns, resource hints, structure metrics, and duplication. Every result links to source evidence. The program is never executed. We show coverage and limitations because a static warning is not proof of a vulnerability.”

## Three-minute architecture explanation

- **0:00–0:40:** Open `AnalysisService.analyze`. Explain the single request and pass sequence. Point to per-module status/data/limitations and unavailable null values.
- **0:40–1:20:** Open `ParserAdapter.parse`, `AstBuilder.build`, and the rewritten `CLexerBase`. Explain in-memory input, the pinned grammar, errors, and separate parser/application symbols.
- **1:20–2:00:** Open `SymbolAnalyzer.visit` and `TacGenerator.condition`. Explain resolved IDs, scope lifetimes, and short-circuit branches.
- **2:00–2:35:** Open `Optimizer.optimize`/`fold` and `CfgBuilder.build`. Explain checked arithmetic, barriers, actual rewrite logs, and basic blocks.
- **2:35–3:00:** Open `ReportProjection.redact` and React’s `analyze` function. Explain response projection, stale handling, source navigation, and export of the existing result.

## Three-minute live demonstration

1. **0:00–0:20:** Load Full pipeline and Analyze. Show one function, two security findings, actual token and rewrite counts.
2. **0:20–0:50:** Compiler → Tokens → AST → Symbols. Select Function `review_submission` and show one resolved source reference.
3. **0:50–1:15:** Diagnostics → Security → expand the unbounded input finding → follow its line link. Explain `%s` and the missing field width.
4. **1:15–1:50:** Optimization. Show `2 * 8` becoming 16, the following chain becoming 17 and 20, and both pass names. Counts are unchanged because no instruction-removal pass is implemented.
5. **1:50–2:20:** Control flow → select a block. Explain true/false edges, loop back edges, continue’s update target, and return edges to exit.
6. **2:20–3:00:** Additional analysis → checked malloc and visible free. Export JSON and explain source exclusion/redaction/coverage.

## Five-minute expanded pipeline walkthrough

Add a full AST initializer expansion and the resolved `base`/`score` IDs. Open the transformation log and follow a rewrite’s source location. Select a CFG branch block and its loop target, then show per-function complexity (1 + three if decisions + one loop = 5 for the hero). Open Help or Compiler → Data flow and identify deferred live-variable analysis. Finish with syntax-error recovery.

## Worked TAC and optimization example

Load Arithmetic. `a = 2 * 8 + 1` generates `%t1 = 2 * 8`, `%t2 = %t1 + 1`, and `a@s1 = %t2`. `b = a + 3` generates `%t3 = a@s1 + 3`, then `b@s2 = %t3` and `return b@s2`.

Constant folding evaluates literal operations. Constant propagation substitutes known scalar definitions within the same block. Alternating rounds expose more foldable operations, eventually producing `return 20`. Both original and optimized streams have six operational instructions. The log has actual intermediate rewrites rather than one invented “improvement percentage.” The hero’s calls/loop are conservative barriers: its initial arithmetic contribution becomes 20, but the optimizer does not pretend to know the final loop-modified score.

## Worked security finding

The hero’s actual `scanf("%s", name)` is a Call whose callee resolves to the stdio catalog. The literal scanner finds an unsuppressed string conversion without a width. CS-SEC-005 is High severity/High confidence, so its score contribution is 15. A `%15s` fixture avoids this rule for a 16-element buffer; this is still not a complete safety proof. `strcpy(destination, name)` creates CS-SEC-002 at Medium/Medium, adding 6. Their total is 21.

Comments saying “scanf” do not trigger the rule. A custom source-defined `strcpy` does not inherit the library rule. These distinctions come from AST calls and resolved symbol origins, not a source substring search.

## CFG explanation

A basic block contains a straight-line instruction region. Labels and instructions after branch/jump/return terminators begin blocks. `CfgBuilder` connects blocks using the optimized instruction targets. Synthetic entry/exit nodes show the function boundary. True/false edges come from BRANCH, fall-through edges from sequential blocks, and returns lead to exit. A back edge targets an earlier emitted block. The display retains disconnected blocks because DCE is deferred. Select a block to inspect the underlying structured instructions.

## Syntax-error recovery

Load Syntax error and Analyze. Show a located C-SYNTAX diagnostic and null downstream metrics, with no risk score. Compiler → Tokens remains inspectable, but Symbols explains why results are withheld. Load Bounded input and Analyze again; valid results return. Editing any analyzed source first marks results stale and disables export until reanalysis.

## Likely examiner questions

| Question | Answer grounded in this implementation |
|---|---|
| Lexer versus parser? | CLexer recognizes tokens from characters; CParser recognizes grammar structure from the token stream. |
| What is a grammar? | Rules describing token combinations. Our pinned CParser.g4 defines functions, declarations, statements, and expression hierarchy. |
| What is an AST? | A tree of meaningful program constructs; Node stores kind, attributes, children, ID, and range. |
| Parse tree versus AST? | The parse tree retains grammar wrappers/terminals; AstBuilder converts it into a simplified educational tree. |
| How does precedence work? | Nested multiplicative/additive grammar rules make multiplication bind before addition; AstBuilder preserves that structure. |
| Why a symbol table? | It records declarations and resolves uses, separating scope/shadowed identities and supporting semantic checks/TAC. |
| What is TAC? | An explicit IR with temporaries and small operations; Instruction also stores branches, calls, memory effects, and returns. |
| Folding versus propagation? | Folding calculates literal operations; propagation substitutes known same-block definitions. Both record actual rewrites. |
| Why refuse overflow or division by zero? | Those cases cannot be safely given a defined signed-int result; BigInteger intermediates and range checks prevent unsafe folding. |
| What is a basic block? | A straight-line region divided at labels and terminators in CfgBuilder. |
| What is a CFG? | A graph of those blocks connected by control-transfer edges, shown from optimized TAC. |
| What is static analysis? | Inspecting program representations without executing the program; this release never runs submitted C. |
| How are unsafe patterns identified? | SecurityAnalyzer examines resolved direct library Call nodes and literal formats/local provenance. |
| Why false positives? | A call may be safe for actual lengths or a credential name may hold a placeholder; our rules do not prove all paths. |
| Why no exact runtime memory? | Source-site counts do not reveal iteration counts, target sizes, ownership paths, allocator behavior, or actual execution. |
| What comes from ANTLR? | Lexer/parser generation, token/runtime machinery, grammar recognition, parse contexts, recovery, and pinned disambiguation support. |
| What did you implement? | Adapter/AST conversion, public scopes/semantic checks, structured TAC, two optimization passes, CFG, rules, metrics, fingerprints, scoring, report projection, and UI. |
| How does React communicate with Java? | JSON over one POST /api/analyze; Vite proxies /api locally. |
| Invalid syntax? | A structured diagnostic result with tokens; downstream data/score are unavailable. |
| What is deferred? | Full preprocessing/types, general pointer/alias/path/interprocedural analyses, DCE, CSE, and live-variable fixed-point analysis. |
| Does a lower score prove safety? | No. It is rounded/capped severity × confidence across assessed findings. |
| Is optimization faster in measurements? | We do not run benchmarks or C programs; we show transformations and truthful instruction counts. |

## Files to open

- `backend/src/main/java/com/codesentinel/parser/ParserAdapter.java`
- `backend/src/main/antlr4/CParser.g4`
- `backend/src/main/java/com/codesentinel/parser/AstBuilder.java`
- `backend/src/main/java/com/codesentinel/analysis/SymbolAnalyzer.java`
- `backend/src/main/java/com/codesentinel/analysis/TacGenerator.java`
- `backend/src/main/java/com/codesentinel/analysis/Optimizer.java`
- `backend/src/main/java/com/codesentinel/analysis/CfgBuilder.java`
- `backend/src/main/java/com/codesentinel/analysis/SecurityAnalyzer.java`
- `backend/src/main/java/com/codesentinel/analysis/AnalysisService.java`
- `frontend/src/main.jsx`, `compiler.jsx`, `graphs.jsx`
- `samples/hero.c`, `samples/arithmetic.c`

## Preparation checklist

Start from the packaged build, confirm JDK 21/health, analyze the hero three consecutive times from reset, rehearse the three-minute script aloud, check the presentation resolution, and keep the saved recording/screenshots/JSON as a backup. Automated rehearsals verify interaction/output consistency; practice the spoken explanation yourself before the actual viva.
