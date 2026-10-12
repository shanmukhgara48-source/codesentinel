package com.codesentinel.analysis;

import com.codesentinel.model.*;
import java.math.BigInteger;
import java.util.*;

public class Optimizer {
  public record Change(
      String instructionId,
      String pass,
      String before,
      String after,
      String reason,
      SourceRange range) {}

  public record Result(
      List<TacGenerator.FunctionIR> functions,
      List<Change> changes,
      List<Diagnostic> diagnostics,
      long beforeCount,
      long afterCount) {}

  private final Map<String, String> display = new HashMap<>();

  public Result optimize(List<TacGenerator.FunctionIR> input, List<SymbolAnalyzer.Symbol> symbols) {
    symbols.forEach(
        s ->
            display.put(s.id(), s.origin().equals("LIBRARY") ? s.name() : s.name() + "@" + s.id()));
    List<TacGenerator.FunctionIR> result = new ArrayList<>();
    List<Change> changes = new ArrayList<>();
    Map<String, Diagnostic> diagnostics = new LinkedHashMap<>();
    for (var f : input) {
      if (f.instructions() == null) {
        result.add(f);
        continue;
      }
      List<Instruction> code = new ArrayList<>(f.instructions());
      Set<String> protectedSymbols = new HashSet<>();
      symbols.stream()
          .filter(s -> s.type().contains("volatile"))
          .forEach(s -> protectedSymbols.add(s.id()));
      code.stream()
          .filter(i -> i.op().equals("ADDRESS"))
          .forEach(i -> protectedSymbols.add(i.args().getFirst()));
      for (int round = 0; round < 10; round++) {
        int before = changes.size();
        for (int i = 0; i < code.size(); i++) {
          var ins = code.get(i);
          var folded = fold(ins, diagnostics);
          if (!folded.equals(ins)) {
            changes.add(
                change(
                    ins,
                    folded,
                    "CONSTANT_FOLDING",
                    "All operands are signed-int constants and the result is representable."));
            code.set(i, folded);
          }
        }
        Map<String, String> constants = new HashMap<>();
        for (int i = 0; i < code.size(); i++) {
          Instruction ins = code.get(i);
          if (Set.of("LABEL", "CALL", "STORE", "LOAD", "READ", "ADDRESS", "INDEX_ADDRESS", "CAST", "SIZEOF")
              .contains(ins.op())) constants.clear();
          List<String> args = ins.args();
          if (ins.integerSafe()
              && Set.of("ASSIGN", "BINARY", "UNARY", "RETURN", "BRANCH").contains(ins.op())) {
            var replaced = args.stream().map(a -> constants.getOrDefault(a, a)).toList();
            if (!replaced.equals(args)) {
              var next =
                  ins.with(
                      ins.op(),
                      replaced,
                      ins.operator(),
                      TacGenerator.render(
                          ins.op(),
                          ins.result(),
                          replaced,
                          ins.operator(),
                          ins.target(),
                          ins.alternative(),
                          display));
              changes.add(
                  change(
                      ins,
                      next,
                      "CONSTANT_PROPAGATION",
                      "This scalar has a known constant definition in the same basic block, with no"
                          + " intervening barrier."));
              ins = next;
              code.set(i, ins);
            }
          }
          if (ins.result() != null) {
            constants.remove(ins.result());
            if (!protectedSymbols.contains(ins.result())
                && ins.op().equals("ASSIGN")
                && ins.integerSafe()
                && constant(ins.args().getFirst()) != null)
              constants.put(ins.result(), ins.args().getFirst());
          }
          if (Set.of("JUMP", "BRANCH", "RETURN").contains(ins.op())) constants.clear();
        }
        if (before == changes.size()) break;
      }
      result.add(new TacGenerator.FunctionIR(f.id(), f.name(), f.status(), new IrMetadata().annotate(code, symbols), f.diagnostics()));
    }
    return new Result(
        result, changes, new ArrayList<>(diagnostics.values()), count(input), count(result));
  }

  public static long count(List<TacGenerator.FunctionIR> functions) {
    return functions.stream()
        .filter(f -> f.instructions() != null)
        .flatMap(f -> f.instructions().stream())
        .filter(i -> !Set.of("DECLARE", "LABEL").contains(i.op()))
        .count();
  }

  private Change change(Instruction a, Instruction b, String pass, String reason) {
    return new Change(a.id(), pass, a.text(), b.text(), reason, a.range());
  }

  private BigInteger constant(String s) {
    try {
      if (!s.matches("-?[0-9]+")) return null;
      BigInteger n = new BigInteger(s);
      return valid(n) ? n : null;
    } catch (NumberFormatException e) {
      return null;
    }
  }

  private boolean valid(BigInteger n) {
    return n.compareTo(BigInteger.valueOf(Integer.MIN_VALUE)) >= 0
        && n.compareTo(BigInteger.valueOf(Integer.MAX_VALUE)) <= 0;
  }

  private Instruction fold(Instruction i, Map<String, Diagnostic> diagnostics) {
    if (!i.integerSafe() || !Set.of("BINARY", "UNARY").contains(i.op())) return i;
    BigInteger a = constant(i.args().getFirst()),
        b = i.args().size() > 1 ? constant(i.args().get(1)) : null;
    if (a == null || (i.op().equals("BINARY") && b == null)) return i;
    BigInteger v;
    try {
      if (i.op().equals("UNARY"))
        v =
            switch (i.operator()) {
              case "-" -> a.negate();
              case "+" -> a;
              case "!" -> a.signum() == 0 ? BigInteger.ONE : BigInteger.ZERO;
              default -> null;
            };
      else
        v =
            switch (i.operator()) {
              case "+" -> a.add(b);
              case "-" -> a.subtract(b);
              case "*" -> a.multiply(b);
              case "/" -> a.divide(b);
              case "%" -> a.remainder(b);
              case "==" -> bool(a.equals(b));
              case "!=" -> bool(!a.equals(b));
              case "<" -> bool(a.compareTo(b) < 0);
              case "<=" -> bool(a.compareTo(b) <= 0);
              case ">" -> bool(a.compareTo(b) > 0);
              case ">=" -> bool(a.compareTo(b) >= 0);
              default -> null;
            };
      if (v == null) return i;
      // INT_MIN / -1 and its remainder are undefined in signed C arithmetic.
      if (!valid(v)
          || (Set.of("/", "%").contains(i.operator())
              && a.equals(BigInteger.valueOf(Integer.MIN_VALUE))
              && b.equals(BigInteger.valueOf(-1)))) throw new ArithmeticException();
    } catch (ArithmeticException e) {
      diagnostics.put(
          i.id(),
          new Diagnostic(
              "OPT-UNSAFE",
              "WARNING",
              "Constant operation left unchanged: division by zero or signed-int overflow.",
              i.range(),
              "The optimizer does not introduce behavior for undefined signed arithmetic."));
      return i;
    }
    var args = List.of(v.toString());
    return i.with(
        "ASSIGN",
        args,
        null,
        TacGenerator.render("ASSIGN", i.result(), args, null, null, null, display));
  }

  private BigInteger bool(boolean b) {
    return b ? BigInteger.ONE : BigInteger.ZERO;
  }
}
