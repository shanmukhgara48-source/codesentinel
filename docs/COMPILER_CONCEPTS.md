# Compiler concepts in CodeSentinel

The workbench exposes intermediate representations so each compiler concept can be explained using an actual output and implementing method.

| Concept | Meaning and implementation |
|---|---|
| Lexical analysis | Characters become tokens. Generated `CLexer` and `ParserAdapter.parse` retain categories and ranges; Compiler’s Tokens tab filters the stream. |
| Grammar and parsing | Grammar rules describe valid token arrangements. `CParser.g4` and generated `CParser.compilationUnit` recognize the translation unit. |
| Syntax analysis | The parser recognizes declarations, functions, statements, and expressions; the adapter error listener collects located failures. |
| Parse tree versus AST | ANTLR builds grammar-rule contexts; `AstBuilder.build` removes punctuation/wrapper rules and creates `Node` declarations, statements, and expressions. `AstExplorer` displays this simplified tree. |
| Operator precedence | Expression rules nest multiplicative inside additive inside relational/equality/logical rules. `AstBuilder.binary` preserves that hierarchy rather than guessing from text. |
| Symbol table | `SymbolAnalyzer` maintains a scope stack, declarations, and resolved references. Public symbol IDs separate identically named shadowed variables. |
| Scope | Global, function/parameter, nested block, and for-loop lifetimes follow push/pop in `SymbolAnalyzer.visit`. The outer function body shares its parameter scope. |
| Semantic analysis | `SymbolAnalyzer.declare`, `registerFunction`, and `visit` check selected duplicates, signatures, undeclared uses, and return presence. They do not establish complete C correctness. |
| Intermediate representation | `Instruction` stores operations and control targets independently of parser objects. `TacGenerator.generate` lowers supported ASTs. |
| Three-address code | Operations use a result and at most two arithmetic operands, with temporaries for subexpressions. Calls are structured effectful instructions with an argument list. |
| Basic block | A maximal instruction region without an internal branch/return boundary. `CfgBuilder.build` starts blocks at labels and after terminators. |
| Control-flow graph | CFG nodes represent blocks and synthetic entry/exit; typed edges show branches, jumps, fall-through, returns, and back edges. React `Cfg` renders the Java result. |
| Constant folding | `Optimizer.fold` computes supported constant operations using BigInteger intermediates and signed 32-bit checks. |
| Constant propagation | `Optimizer.optimize` replaces operands whose resolved scalar has a known constant in the current block. It clears bindings at control/effect barriers. |
| Data-flow analysis | Live-variable IN/OUT sets would require a backward fixed point over the graph. This extension is deferred and shown as NOT_IMPLEMENTED. Block-local constant propagation is implemented; general inter-block data flow is absent. |

Paths for Java classes are under `backend/src/main/java/com/codesentinel`; frontend components are under `frontend/src`.

## Worked arithmetic trace

The actual `samples/arithmetic.c` contains:

```c
int calculate(void) {
    int a = 2 * 8 + 1;
    int b = a + 3;
    return b;
}
```

Its AST has a Function containing a Block with two Declaration nodes and a Return. The initializer for `a` is Binary `+` whose left child is Binary `*`. Symbols distinguish `a@s1` and `b@s2` from temporaries.

```text
Original                         Optimized
declare a@s1 : int              declare a@s1 : int
%t1 = 2 * 8                     %t1 = 16
%t2 = %t1 + 1                   %t2 = 17
a@s1 = %t2                      a@s1 = 17
declare b@s2 : int              declare b@s2 : int
%t3 = a@s1 + 3                  %t3 = 20
b@s2 = %t3                      b@s2 = 20
return b@s2                     return 20
```

Folding first replaces `2 * 8`. Propagation replaces its uses and exposes new constant operands. Alternating rounds fold newly exposed operations; the ten-round limit keeps the work bounded. The API records each actual rewrite, so the change log can contain multiple rewrites of one instruction.

Both streams have six operational instructions plus two declaration records. No instruction was removed: simpler operands do not imply a smaller instruction count.

## Branch and loop lowering

`TacGenerator.condition` lowers `&&` and `||` to control flow. The right operand is placed only behind the appropriate left-operand branch, preserving short-circuit calls. It does not replace an expression containing unsequenced arithmetic side effects with an arbitrary evaluation order.

`statement` tracks a stack of LoopTargets. A for-loop’s continue target is the update label; while/do-while continue targets are the condition label. Break targets the innermost loop’s exit. Early returns end their basic blocks; subsequent emitted blocks remain visible because dead-code elimination is deferred.

## Optimization validity

The profile is signed 32-bit integer arithmetic, with wider intermediate computation and checked ranges. Overflow, division by zero, INT_MIN divided/remainder by -1, floating-point conversions, and uncertain volatile/addressed bindings are left unchanged or withheld. Calls, loads/stores, address operations, casts, sizeof, labels, and control-flow boundaries clear uncertain bindings. The optimizer does not move calls or memory operations and does not propagate constants across branch joins or loop iterations.
