package com.codesentinel.model;

import java.util.*;

public record Instruction(
    String id,
    String op,
    String result,
    List<String> args,
    String operator,
    String target,
    String alternative,
    SourceRange range,
    boolean integerSafe,
    String text) {
  public Instruction with(String newOp, List<String> newArgs, String newOperator, String newText) {
    return new Instruction(
        id,
        newOp,
        result,
        List.copyOf(newArgs),
        newOperator,
        target,
        alternative,
        range,
        integerSafe,
        newText);
  }
}
