package com.codesentinel.model;

import java.util.*;

/** Text is presentation only; operands and effects are explicit analysis facts. */
public record Instruction(
    String id, String op, String result, List<String> args, String operator,
    String target, String alternative, SourceRange range, boolean integerSafe, String text,
    String nodeId, List<Operand> operands, Operand output, Effects effects) {
  public record Operand(String ref, String kind, String type, String symbolId, String storage, boolean volatileAccess) {}
  public record Effects(List<String> uses, List<String> defines, List<String> mayDefines,
      boolean readsMemory, boolean writesMemory, boolean calls, boolean volatileAccess, boolean mayTrap) {}

  public Instruction(String id, String op, String result, List<String> args, String operator,
      String target, String alternative, SourceRange range, boolean integerSafe, String text) {
    this(id, op, result, args, operator, target, alternative, range, integerSafe, text,
        id.substring(0, id.lastIndexOf(":i")), List.of(), null, null);
  }

  public Instruction with(String newOp, List<String> newArgs, String newOperator, String newText) {
    // Re-annotated after optimization; stale operand/effect metadata is never published.
    return new Instruction(id, newOp, result, List.copyOf(newArgs), newOperator,
        target, alternative, range, integerSafe, newText);
  }
}
