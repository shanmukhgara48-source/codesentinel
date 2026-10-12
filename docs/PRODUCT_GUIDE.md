# CodeSentinel Product Guide

A simple guide for faculty and friends

CodeSentinel helps students understand a C program by showing its structure, selected mistakes, and compiler stages. A student can paste a small program, choose a learning sample, or upload a C file. The workbench then presents results with explanations and links to the relevant source lines.

### Why this product is useful

Compiler Design lessons often introduce tokens, syntax trees, symbol tables, intermediate code, and control flow separately. CodeSentinel connects these ideas using the same program. A faculty member can follow a calculation or loop from the source code to its internal representation and ask students to explain each step.

The main journey is simple: enter C code, select Analyze code, inspect the results, and export a JSON report. Analysis happens on the local computer. Submitted C programs are never executed or compiled into a runnable binary.

### Who can use it

The current product is intended for students learning C and compiler design, faculty conducting laboratory demonstrations, and friends who want to understand how a program is analyzed. It works best with small, single-file laboratory programs.

This guide describes the reviewed implementation on 12 October 2026. It covers existing features, a demonstration, local setup, and important limits. CodeSentinel is an educational tool. Its warnings help a person review code; they do not prove that a program is safe or correct.

## The workspace and compiler features

### A source editor beside the results

The CodeMirror editor shows line numbers and colors C syntax. It supports undo, redo, matching brackets, and highlighting of selected source locations. Desktop users can resize the split between the editor and results. On smaller screens, the panels stack vertically.

### The five main result tabs

| Tab | What the reader can inspect |
|---|---|
| Overview | Function, token, finding, and transformation counts, plus stage coverage. |
| Diagnostics | Compiler messages and Security, Resources, Performance, and Duplication findings. |
| Compiler | AST, symbols, tokens, selected semantic checks, and the unavailable data-flow stage. |
| Control flow | Basic blocks, branch and loop edges, block instructions, zoom, and pan. |
| Optimization | Original TAC, optimized TAC, and explanations of actual rewrites. |

### Tokens and the syntax tree

A token is a meaningful piece of code, such as a name, number, keyword, or operator. ANTLR produces the real token stream and checks grammar structure. The AST, or abstract syntax tree, groups meaningful constructs such as functions, declarations, calculations, and loops. Users can expand the tree and inspect a selected node.

### Symbols and selected semantic checks

The symbol table records declared names, types, scopes, and source locations. Separate symbol IDs distinguish variables that have the same name in different scopes. Resolved references show which declaration a use belongs to. Checks cover selected undeclared uses, duplicate declarations and definitions, conflicting supported function signatures, and whether a return has a value when required.

## Intermediate code and optimization

### Three address code

Three-address code, called TAC, breaks a calculation into small operations. Temporary names store intermediate values. CodeSentinel also represents declarations, assignments, calls, memory operations, labels, branches, jumps, and returns. It shows an educational representation; the TAC is not executable machine code.

### A worked example

```
int calculate(void) {
    int a = 2 * 8 + 1;
    int b = a + 3;
    return b;
}
```

The original TAC first multiplies 2 by 8, then adds 1, assigns the result to a, adds 3, assigns b, and returns b. The optimized result eventually contains return 20.

### The two implemented optimization passes

Constant folding calculates an operation when its operands are known constants. For example, 2 * 8 becomes 16. Constant propagation replaces a variable or temporary with a known value in the same basic block. The passes can expose further calculations, so the workbench records every actual rewrite and its reason.

The optimizer uses a signed 32-bit integer profile. It refuses folding that would overflow or divide by zero. It clears uncertain values at calls, memory operations, and control-flow boundaries. It does not claim a measured speed improvement, and the current passes do not remove instructions.

### Control flow

A basic block is a sequence of instructions with a single control-transfer boundary. The control-flow graph connects these blocks with true, false, jump, fall-through, and return edges. Select a block to inspect its instructions. The graph comes from optimized TAC. Disconnected blocks remain visible because dead-code elimination is not implemented.

Short-circuit logic is represented with branches. A for-loop continue goes to its update step; a while-loop continue goes to its condition. Unsupported or semantically invalid functions receive a reason for withheld TAC and CFG instead of an incomplete instruction list.

## Code review features and reports

### Security findings

The rules inspect resolved library calls in the AST. They flag gets, capacity review for strcpy, strcat, and sprintf, and literal scanf-family formats with an unbounded unsuppressed %s. They also track limited local input provenance into system and identify credential-like names assigned string literals. Comments that merely mention these APIs are not treated as calls.

Each finding includes a rule ID, severity, confidence, source location, excerpt, explanation, suggested action, and limitations. A warning may still appear for an operation that is safe with a particular input. A bounded format avoids one rule but does not prove complete safety.

### Memory and resource hints

The workbench counts malloc, calloc, realloc, and free call sites. It shows whether an allocation appears in a loop, whether a supported null check is recognized, and whether a later local free is visible. It flags fixed arrays larger than the default review threshold of 1,024 elements. These are source patterns; they do not establish exact memory use or prove leaks on every path.

### Structure and duplication

Additional analysis shows line counts, declarations, branches, loops, nesting, and complexity by function. Complexity is calculated as 1 plus assessed if statements, loops, && operators, and || operators. It is a source metric, not a running-time measurement. Whole function bodies with at least 30 significant tokens are compared for exact matches and consistent identifier renaming.

### Export and privacy

Export JSON downloads the response already received from Java. It includes source metadata, compiler artifacts, findings, limits, and heuristic review-priority score contributions. The current light interface does not show a score contribution panel. Raw source is excluded, but selected tokens and excerpts remain. Suspected credential literals are redacted before excerpts are shortened. The editor keeps the original source.

Credential detection is a name-and-literal heuristic. It can match fake placeholders and miss other secrets. Inspect any report before sharing it. Editing source marks existing results stale and disables export and source navigation until a new analysis finishes.

## Using and demonstrating CodeSentinel

### The normal user journey

- Choose Full pipeline from the sample menu, paste a small C program, or use Upload .c.
- Select Analyze code. Ctrl+Enter or Command+Enter also starts analysis.
- Read Overview and check which stages completed or were withheld.
- Open Diagnostics. Filter or search the findings, expand one, and follow its source link.
- Open Compiler to inspect tokens, AST, symbols, and selected semantic checks.
- Use Optimization to compare TAC and read the transformation log. Use Control flow to select a block.
- Expand Additional analysis for resources, complexity, and duplication. Export JSON when the source and result match.

### A demonstration in under three minutes

| Time | Action |
|---|---|
| 0 to 30 seconds | Analyze Full pipeline and show the overview. |
| 30 to 65 seconds | Show an AST node and its symbol or token information. |
| 65 to 100 seconds | Open the unbounded input finding and highlight scanf in the source. |
| 100 to 135 seconds | Show an actual constant rewrite and explain folding and propagation. |
| 135 to 160 seconds | Select a CFG block and explain a branch or loop edge. |
| 160 to 180 seconds | Show the allocation hints and export the report. |

### Useful learning samples

The 12 bundled samples cover the full pipeline, arithmetic, scopes, unsafe string input, bounded input, a fake credential, loops, resources, repeated functions, a syntax error, unsupported control flow, and unsupported preprocessing. Their unsafe patterns are deliberate teaching examples.

Keep Arithmetic ready for return 20. Use Syntax error to demonstrate located messages and withheld downstream results. Load Bounded input afterward to show recovery. Use the macro sample to explain why unsupported preprocessing prevents downstream analysis.

## Local setup and product architecture

### Requirements and startup

Use Java 21 and Node.js 20.19 or later in the 20 series, or 22.12 or later. Node 24 is the version used for the current local checks. npm is required. The included Maven wrapper downloads Maven when first needed. Internet access is needed for initial dependencies and Chromium test installation.

```
./scripts/setup.sh
./scripts/start.sh
```

Run these commands in the project folder on macOS or Linux. Open http://127.0.0.1:5173. Java listens on port 8080. Both services bind to localhost. After setup, the built demo can start without network access. Ctrl+C stops both services. Stop the demo before rebuilding; setup and verification check that the ports are free.

### How the product works

- React sends one source file as JSON to the local Java API.
- The parser produces tokens and syntax diagnostics. The adapter builds the simplified AST.
- Java checks the preprocessing boundary, resolves names, and runs the supported analysis passes.
- Supported functions become TAC, then optimized TAC, then control-flow graphs.
- The report projection redacts recognized credential values and returns the structured response.
- React displays the artifacts and downloads that same response when the user exports.

### API and project folders

| Endpoint | Purpose |
|---|---|
| GET /api/health | Reports application and parser identity. |
| GET /api/samples | Returns the bundled learning samples. |
| POST /api/analyze | Accepts source and an optional display filename; returns one analysis. |

backend contains the Java API, parser adapter, models, and analysis algorithms. frontend contains the React workbench. samples contains the C fixtures. scripts contains setup, startup, and test commands. docs contains architecture, compiler concepts, analysis rules, limitations, and viva notes. The ANTLR grammar snapshot and upstream notices are retained with checksums.

## Limits and verification

### How to read availability

Completed means the pass finished within its supported scope. Partial means some constructs were outside that scope. Skipped means results were withheld. Not implemented identifies a deferred feature. A dash or null means a value is unavailable; it must not be read as zero. Syntax errors can return a successful HTTP response containing a structured PARSE_ERROR analysis result.

### Current limits

The tool analyzes one file. It recognizes only a limited catalog for stdio.h, stdlib.h, string.h, and stddef.h. It does not read headers, expand macros, or perform full C type checking. Other preprocessing withholds downstream results. General alias, path, taint, and interprocedural analysis are absent.

TAC arithmetic is restricted to supported signed 32-bit decimal operands. Octal, hexadecimal, suffixed or wider arithmetic, pointer arithmetic, persistent local storage, and other unsupported cases are withheld. Full live-variable analysis, reaching definitions, dead-code elimination, and common subexpression elimination are not implemented. There are no user accounts, database, saved history, or hosted application deployment.

Input limits are 64 KiB of source, 10,000 significant tokens, 128 delimiter levels, 512 grammar-tree levels, and 128 AST levels. Excessive expressions return a structured input error. The service does not execute submitted C, launch a native preprocessor, or write submitted source files.

### What was verified

The 12 October 2026 local review passed 73 backend tests, the frontend production build, and 11 browser tests against the real Java backend. The browser suite includes three consecutive complete demo rehearsals, JSON export, syntax recovery, stale-result protection, upload, dialogs, and layouts at 320, 768, and 1440 pixels. Parser provenance checksums also passed.

Regression tests cover long-credential redaction, excessive expression depth and recovery, decimal versus octal handling, pointer elements, persistent storage, function return forms, prototype signatures and scope, and finding categories. These checks provide evidence for the reviewed cases. They do not prove the absence of every possible defect or full C conformance.

### Before a faculty demonstration

Start the packaged application fresh, confirm the local backend is connected, and rehearse on the actual presentation screen. Keep the saved screenshots as a backup. Explain a warning together with its stated limitation, and use the existing viva guide for detailed compiler questions.
