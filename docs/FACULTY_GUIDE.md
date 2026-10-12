# Faculty demonstration guide

CodeSentinel lets students inspect the stages of a bounded C analysis without running their program. It uses a real ANTLR parser and application analysis passes. The strongest demonstration follows one small file from source through located artifacts, conservative rewrites, control flow, and scalar data flow.

## Start a clean demonstration

Install Java 21 and a supported Node.js version, then run `./scripts/setup.sh` once. Stop other instances from this project before setup or verification. Run `./scripts/start.sh` and open http://127.0.0.1:5173. Confirm Local backend connected. Select Full pipeline and Analyze code. Teaching samples contain deliberate findings and a fake credential.

## Three minute script

| Time | Exact interaction and explanation |
|---|---|
| 0:00–0:25 | Analyze Full pipeline. Explain that the program is parsed and inspected, never executed. Show stage availability and the two actual security findings. |
| 0:25–0:50 | Compiler → AST → Function review_submission. Open Source connections. Show that tokens, resolved symbol IDs, TAC records, and CFG blocks come from that subtree. Open Symbols to distinguish declarations from uses. |
| 0:50–1:15 | Diagnostics → Security. Open the unbounded input finding and follow View line in source. Explain why `%s` needs a field width and why the warning is not proof of exploitability. |
| 1:15–1:45 | Optimization. Compare original and optimized TAC, show an actual folding/propagation entry, and follow its source. Open Operands & effects on an instruction. The counts remain unchanged because no instruction-removal pass runs. |
| 1:45–2:15 | Control flow. Select B0, use Fit graph, then reset for detail. Explain true/false routes and a loop back edge. The block selector and incoming/outgoing buttons also work with the keyboard. |
| 2:15–2:40 | Compiler → Data flow. Show a converged live-variable calculation. Open Iteration trace and select the last round: no blocks change. Reaching definitions answers a different question about earlier writes. |
| 2:40–3:00 | Expand Additional analysis for the checked allocation and visible free. Export JSON. Explain assessed coverage, redaction, and the limits below. |

Automated tests rehearse this journey three times in fresh browser contexts. Rehearse the spoken explanation yourself on the actual classroom machine. The screenshots linked in README are a backup; a recording can be created with the included demo script.

## Explain availability honestly

Completed means a pass finished in its supported scope. Partial means some functions or constructs were outside that scope. Skipped means no result was published. Null or a dash means unavailable, not zero. Syntax errors retain located tokens/diagnostics and withhold downstream results. Unsupported preprocessing withholds the pipeline because expansion could change the program.

For recovery, load Syntax error and analyze, show the located error, then load Bounded input and analyze again. Editing marks old results stale and blocks source navigation/export until reanalysis. Failed or unreadable responses give retry guidance; the browser request has a 20-second timeout.

## Questions to ask a student

- Which AST node implements `2 * 8 + 1`, and how does it preserve precedence?
- Why do shadowed variables have distinct symbol IDs?
- Which rewrite is folding, and which is propagation?
- Why does a call or memory write prevent ordinary constant assumptions?
- Which branch evaluates the right side of `&&`? Where does a for-loop continue go?
- Why does a discarded volatile expression still produce a READ?
- Why are calls inside non-VLA sizeof not executed?
- What do IN/OUT mean, and how does the unchanged round demonstrate a fixed point?
- At a branch join, why can two writes to the same variable both reach a later read?

## Boundaries to state

This is a single-file educational analyzer with four catalog headers, a simplified AST, selected semantic checks, and a signed 32-bit arithmetic profile. It is not a conforming C compiler or a security certification tool. Full preprocessing, full C types, precise aliases/memory values, path-sensitive ownership/taint, interprocedural analysis, DCE, and CSE are absent.

Scalar data flow is bounded and conservative. Entry and uninitialized definitions do not prove definite assignment. Possible writes can retain extra definitions. Unsupported TAC or exceeded budgets expose a reason instead of incomplete sets. The client timeout does not promise server-side cancellation. No C execution benchmark, classroom-hardware trial, or non-Chromium verification is claimed.

See DATA_FLOW for the equations, ANALYSIS_LIMITATIONS for the exact boundary, and VIVA_GUIDE for deeper worked examples.
