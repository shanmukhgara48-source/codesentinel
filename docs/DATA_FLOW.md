# Data flow explained

CodeSentinel computes two scalar analyses on **original TAC**. Original TAC preserves variable uses that constant propagation can later replace. The Control flow tab displays optimized TAC; the current optimizer changes operands without removing instructions or changing block boundaries.

## Live variables

A value is live if some later instruction may read it before another definite write replaces it. Work backward from each block’s uses:

```text
OUT[B] = union of IN for B's successors
IN[B]  = USE[B] union (OUT[B] minus DEF[B])
```

USE contains scalar reads before a definite write in the block. DEF contains definite writes. A possible write through a call or pointer cannot remove liveness, because the previous value might survive.

## Reaching definitions

A definition is a write identified by its instruction and scalar value. Work forward from earlier writes:

```text
IN[B]  = union of OUT for B's predecessors
OUT[B] = GEN[B] union (IN[B] minus KILL[B])
```

GEN contains writes surviving the end of the block. KILL contains older definitions replaced by definite writes. Possible call/store writes add alternatives without killing older definitions. Entry definitions mean unknown incoming values. DECLARE definitions mean uninitialized storage, not a known runtime value.

For `int x; if(c) x=1; else x=2; return x;`, the return block receives **both** branch definitions of x. It must not choose one branch. For a loop, definitions can travel around the back edge over several rounds. A write in an unreachable block cannot reach the return.

## Iteration traces

Both calculations start with empty sets. Each synchronous round reads the previous round’s sets and calculates the next sets for reachable blocks. Union and the fixed transfer functions are monotone: information grows until another round changes nothing. That unchanged round confirms the fixed point. The UI shows the actual changed blocks for each retained round, the final sets, transfer facts, equations, and definition locations.

## Typed operands and effects

Instruction records retain their originating AST node ID and source range. Operand kinds distinguish literals, scalar symbols, array addresses, functions, temporaries, and type labels. Declared types, the signed-int profile, symbolic sizes, and unknown results are explicit.

Effects list scalar uses, definite writes, possible writes, memory reads/writes, calls, volatile access, and possible traps. A discarded volatile read is still a READ instruction. A non-VLA sizeof operand is unevaluated. Array addresses describe storage identity; array elements and pointed-to memory contents are outside scalar definition sets.

Calls, loads, and stores conservatively account for global and address-taken scalar values. This overapproximation can keep values live or retain definitions that will not occur on a particular path. No optimizer removes instructions using these sets.

## Limits and unavailable results

Each function has limits of 256 CFG nodes, 1,024 definitions, 128 rounds, and 100,000 state set entries. Exceeding a limit withholds both fixed points for that function and explains why. Unsupported or semantically invalid TAC also withholds data flow.

Each analysis trace retains at most 50,000 entries. Trace truncation is labeled; converged final sets remain available. Disconnected blocks are visible with empty IN/OUT sets. These results do not establish precise aliases, memory values, definite assignment, whole-program behavior, or path-sensitive safety.

The implementation is `analysis/DataFlowAnalyzer.java`; `DataFlowTest` independently checks both equations on a loop/branch graph, branch joins, unreachable paths, uncertain call writes, typed metadata, and budget refusal.
