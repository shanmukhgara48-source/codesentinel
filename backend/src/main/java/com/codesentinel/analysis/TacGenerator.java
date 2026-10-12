package com.codesentinel.analysis;

import com.codesentinel.model.*;
import java.util.*;

/** Direct AST lowering. Unsupported functions never expose an incomplete instruction stream. */
public class TacGenerator {
  public record FunctionIR(
      String id,
      String name,
      String status,
      List<Instruction> instructions,
      List<Diagnostic> diagnostics) {}

  private record Value(String ref, boolean integerSafe) {}

  private record LoopTargets(String end, String next) {}

  private static class UnsupportedIR extends RuntimeException {
    final Node node;

    UnsupportedIR(Node n, String message) {
      super(message);
      node = n;
    }
  }

  private List<Instruction> code;
  private final Map<String, SymbolAnalyzer.Symbol> symbolInfo = new HashMap<>();
  private final Map<String, String> display = new LinkedHashMap<>();
  private final Deque<LoopTargets> loops = new ArrayDeque<>();
  private int temp, label, serial;

  public List<FunctionIR> generate(
      Node ast, List<SymbolAnalyzer.Symbol> symbols, List<Diagnostic> semantics) {
    symbols.forEach(s -> symbolInfo.put(s.id(), s));
    symbols.forEach(
        s ->
            display.put(s.id(), s.origin().equals("LIBRARY") ? s.name() : s.name() + "@" + s.id()));
    List<FunctionIR> functions = new ArrayList<>();
    for (Node fn : ast.all())
      if (fn.kind.equals("Function")) {
        code = new ArrayList<>();
        temp = 0;
        label = 0;
        serial = 0;
        loops.clear();
        var errors =
            semantics.stream()
                .filter(
                    d ->
                        d.severity().equals("ERROR") && d.range() != null
                            && ((d.range().startOffset() >= fn.range.startOffset()
                            && d.range().endOffset() <= fn.range.endOffset())
                            || ast.children.stream().noneMatch(top -> top.kind.equals("Function")
                                && d.range().startOffset() >= top.range.startOffset()
                                && d.range().endOffset() <= top.range.endOffset())))
                .toList();
        if (!errors.isEmpty()) {
          functions.add(
              new FunctionIR(
                  fn.id,
                  fn.text("name"),
                  "SKIPPED",
                  null,
                  List.of(
                      new Diagnostic(
                          "IR-SEMANTIC",
                          "WARNING",
                          "TAC withheld for a function with semantic errors.",
                          fn.range,
                          "Resolve the semantic diagnostics before lowering this function."))));
          continue;
        }
        try {
          if (fn.all().stream().anyMatch(n -> n.kind.equals("Unsupported") || n.attributes.containsKey("unsupported")))
            throw new UnsupportedIR(fn, "This function contains an unsupported construct or signature.");
          Node body =
              fn.children.stream().filter(n -> n.kind.equals("Block")).findFirst().orElseThrow();
          statement(body);
          if (code.isEmpty() || !code.getLast().op().equals("RETURN"))
            emit("RETURN", null, fn.text("name").equals("main") ? List.of("0") : List.of(), null, null, null, fn, fn.text("name").equals("main"));
          functions.add(
              new FunctionIR(fn.id, fn.text("name"), "COMPLETED", new IrMetadata().annotate(code, symbols), List.of()));
        } catch (UnsupportedIR e) {
          functions.add(
              new FunctionIR(
                  fn.id,
                  fn.text("name"),
                  "SKIPPED",
                  null,
                  List.of(
                      new Diagnostic(
                          "IR-UNSUPPORTED",
                          "WARNING",
                          e.getMessage(),
                          e.node.range,
                          "No TAC or CFG is published for this function. Other analysis modules can"
                              + " still inspect supported syntax."))));
        }
      }
    return functions;
  }

  private String freshTemp() {
    return "%t" + (++temp);
  }

  private String freshLabel() {
    return "L" + (++label);
  }

  private void mark(String label, Node n) {
    emit("LABEL", null, List.of(), null, label, null, n, false);
  }

  private void jump(String label, Node n) {
    emit("JUMP", null, List.of(), null, label, null, n, false);
  }

  private void statement(Node n) {
    if (n.attributes.containsKey("unsupported")) throw new UnsupportedIR(n, n.text("unsupported"));
    switch (n.kind) {
      case "Block", "Statements", "Declarations", "Init", "Step" ->
          n.children.forEach(this::statement);
      case "Declaration" -> {
        if (n.text("type").matches(".*\\b(static|thread_local|_Thread_local)\\b.*"))
          throw new UnsupportedIR(n, "Persistent local storage is outside the TAC lifetime model.");
        var dimensions = (List<?>) n.attributes.getOrDefault("arrayDimensions", List.of());
        emit(
            "DECLARE",
            n.text("symbolId"),
            List.of(
                n.text("type")
                    + "*".repeat(((Number) n.attributes.getOrDefault("pointerDepth", 0)).intValue())
                    + (dimensions.isEmpty()
                        ? ""
                        : "["
                            + String.join("][", dimensions.stream().map(Object::toString).toList())
                            + "]")),
            null,
            null,
            null,
            n,
            false);
        if (!n.children.isEmpty()) {
          Value value = expression(n.children.getFirst());
          emit(
              "ASSIGN",
              n.text("symbolId"),
              List.of(value.ref()),
              null,
              null,
              null,
              n,
              isInteger(n) && value.integerSafe());
        }
      }
      case "ExpressionStatement" -> {
        if (!n.children.isEmpty()) expression(n.children.getFirst());
      }
      case "Return" -> {
        Value value = n.children.isEmpty() ? null : expression(n.children.getFirst());
        emit(
            "RETURN",
            null,
            value == null ? List.of() : List.of(value.ref()),
            null,
            null,
            null,
            n,
            value != null && value.integerSafe());
      }
      case "If" -> {
        String yes = freshLabel(), no = freshLabel(), end = freshLabel();
        condition(n.children.get(0), yes, no);
        mark(yes, n);
        statement(n.children.get(1));
        jump(end, n);
        mark(no, n);
        if (n.children.size() > 2) statement(n.children.get(2));
        mark(end, n);
      }
      case "While", "DoWhile" -> {
        String guard = freshLabel(), body = freshLabel(), end = freshLabel();
        loops.push(new LoopTargets(end, guard));
        if (n.kind.equals("DoWhile")) {
          mark(body, n);
          statement(n.children.get(1));
          mark(guard, n);
          condition(n.children.get(0), body, end);
        } else {
          mark(guard, n);
          condition(n.children.get(0), body, end);
          mark(body, n);
          statement(n.children.get(1));
          jump(guard, n);
        }
        mark(end, n);
        loops.pop();
      }
      case "For" -> {
        String guard = freshLabel(), body = freshLabel(), step = freshLabel(), end = freshLabel();
        statement(n.children.get(0));
        mark(guard, n);
        var cond = n.children.get(1);
        if (cond.children.isEmpty()) jump(body, n);
        else condition(cond.children.getFirst(), body, end);
        mark(body, n);
        loops.push(new LoopTargets(end, step));
        statement(n.children.get(3));
        mark(step, n);
        statement(n.children.get(2));
        jump(guard, n);
        mark(end, n);
        loops.pop();
      }
      case "Break", "Continue" -> {
        if (loops.isEmpty()) throw new UnsupportedIR(n, n.kind + " outside a modeled loop.");
        jump(n.kind.equals("Break") ? loops.peek().end() : loops.peek().next(), n);
      }
      case "Unsupported" -> throw new UnsupportedIR(n, n.text("reason"));
      default -> expression(n);
    }
  }

  private boolean intBase(Node n) {
    return Set.of("int", "signed int", "signed")
        .contains(n.text("type").replaceAll("\\b(const|volatile)\\s*", "").strip());
  }

  private boolean isInteger(Node n) {
    return intBase(n)
        && ((Number) n.attributes.getOrDefault("pointerDepth", 0)).intValue() == 0
        && ((List<?>) n.attributes.getOrDefault("arrayDimensions", List.of())).isEmpty();
  }

  private boolean integerElement(Node n) {
    int pointers = ((Number) n.attributes.getOrDefault("pointerDepth", 0)).intValue();
    var arrays = (List<?>) n.attributes.getOrDefault("arrayDimensions", List.of());
    return n.kind.equals("Identifier") && intBase(n)
        && ((pointers == 1 && arrays.isEmpty()) || (pointers == 0 && arrays.size() == 1));
  }

  private Value expression(Node n) {
    return switch (n.kind) {
      case "Identifier" -> {
        if (n.text("symbolId").isEmpty())
          throw new UnsupportedIR(n, "Unresolved identifier " + n.text("name"));
        if (n.text("type").contains("volatile")
            && ((Number) n.attributes.getOrDefault("pointerDepth", 0)).intValue() == 0 && !n.text("category").equals("FUNCTION")
            && ((List<?>) n.attributes.getOrDefault("arrayDimensions", List.of())).isEmpty()) {
          String read = freshTemp();
          emit("READ", read, List.of(n.text("symbolId")), null, null, null, n, isInteger(n));
          yield new Value(read, isInteger(n));
        }
        yield new Value(n.text("symbolId"), isInteger(n));
      }
      case "Literal" -> new Value(n.text("value"), n.text("literalType").equals("int")
          && new java.math.BigInteger(n.text("value")).compareTo(java.math.BigInteger.valueOf(Integer.MAX_VALUE)) <= 0);
      case "Sequence" -> {
        Value result = new Value("0", true);
        for (Node child : n.children) result = expression(child);
        yield result;
      }
      case "Assignment" -> assign(n);
      case "Update" -> update(n);
      case "Binary" -> {
        String op = n.text("operator");
        if (op.equals("&&") || op.equals("||")) {
          String result = freshTemp(), yes = freshLabel(), no = freshLabel(), end = freshLabel();
          condition(n, yes, no);
          mark(yes, n);
          emit("ASSIGN", result, List.of("1"), null, null, null, n, true);
          jump(end, n);
          mark(no, n);
          emit("ASSIGN", result, List.of("0"), null, null, null, n, true);
          mark(end, n);
          yield new Value(result, true);
        }
        if (volatileReads(n) > 1)
          throw new UnsupportedIR(n, "Multiple unsequenced volatile reads are outside the TAC ordering model.");
        if (n.all().stream().anyMatch(c -> Set.of("Call", "Update", "Assignment").contains(c.kind)))
          throw new UnsupportedIR(
              n,
              "Unsequenced side effects inside arithmetic/comparison expressions are not lowered.");
        Value a = expression(n.children.get(0)), b = expression(n.children.get(1));
        if (!Set.of("+", "-", "*", "/", "%", "<", "<=", ">", ">=", "==", "!=").contains(op))
          throw new UnsupportedIR(n, "Operator " + op + " is outside the TAC subset.");
        if (!Set.of("==", "!=").contains(op) && (!a.integerSafe() || !b.integerSafe()))
          throw new UnsupportedIR(
              n,
              "Only signed-int arithmetic and comparisons are modeled; pointer arithmetic and"
                  + " conversions are withheld.");
        String result = freshTemp();
        emit(
            "BINARY",
            result,
            List.of(a.ref(), b.ref()),
            op,
            null,
            null,
            n,
            a.integerSafe() && b.integerSafe());
        yield new Value(result, a.integerSafe() && b.integerSafe());
      }
      case "Unary" -> {
        String op = n.text("operator");
        if (op.equals("&")) yield address(n.children.getFirst());
        Value v = expression(n.children.getFirst());
        String result = freshTemp();
        if (op.equals("*")) {
          if (!pointerLike(n.children.getFirst()))
            throw new UnsupportedIR(n, "Dereference requires a modeled pointer or array operand.");
          boolean integer =
              integerElement(n.children.getFirst());
          emit("LOAD", result, List.of(v.ref()), null, null, null, n, integer);
          yield new Value(result, integer);
        }
        if (!Set.of("!", "+", "-").contains(op))
          throw new UnsupportedIR(n, "Unsupported unary operator " + op);
        if (!op.equals("!") && !v.integerSafe())
          throw new UnsupportedIR(n, "Unary arithmetic requires a supported signed-int operand.");
        emit("UNARY", result, List.of(v.ref()), op, null, null, n, v.integerSafe());
        yield new Value(result, v.integerSafe());
      }
      case "Call" -> {
        Node callee = n.children.getFirst();
        if (!callee.kind.equals("Identifier") || !callee.text("category").equals("FUNCTION"))
          throw new UnsupportedIR(n, "Indirect function calls are not lowered.");
        if (n.children.subList(1, n.children.size()).stream().filter(arg -> volatileReads(arg) > 0).count() > 1)
          throw new UnsupportedIR(n, "Multiple unsequenced volatile call arguments are outside the TAC ordering model.");
        List<String> args = new ArrayList<>();
        args.add(expression(callee).ref());
        for (Node arg : n.children.subList(1, n.children.size())) {
          if (arg.all().stream()
              .anyMatch(c -> Set.of("Call", "Update", "Assignment").contains(c.kind)))
            throw new UnsupportedIR(n, "Side-effecting call arguments are outside the TAC subset.");
          args.add(expression(arg).ref());
        }
        String result = freshTemp();
        emit("CALL", result, args, null, null, null, n, false);
        yield new Value(result, false);
      }
      case "Index" -> {
        Value ptr = address(n);
        String result = freshTemp();
        boolean integer =
            integerElement(n.children.getFirst());
        emit("LOAD", result, List.of(ptr.ref()), null, null, null, n, integer);
        yield new Value(result, integer);
      }
      case "Sizeof" -> {
        String result = freshTemp();
        emit(
            "SIZEOF",
            result,
            List.of(n.text("type").isEmpty() ? "expression (unevaluated)" : n.text("type")),
            null,
            null,
            null,
            n,
            false);
        yield new Value(result, false);
      }
      case "Cast" -> {
        Value v = expression(n.children.getFirst());
        String result = freshTemp();
        emit("CAST", result, List.of(v.ref(), n.text("type")), null, null, null, n, false);
        yield new Value(result, false);
      }
      case "Unsupported" -> throw new UnsupportedIR(n, n.text("reason"));
      default -> throw new UnsupportedIR(n, "Unsupported expression: " + n.kind);
    };
  }

  private Value address(Node n) {
    if (n.kind.equals("Unary") && n.text("operator").equals("*")) {
      if (!pointerLike(n.children.getFirst())) throw new UnsupportedIR(n, "A memory target requires a modeled pointer.");
      return expression(n.children.getFirst());
    }
    String result = freshTemp();
    if (n.kind.equals("Identifier"))
      emit("ADDRESS", result, List.of(n.text("symbolId")), null, null, null, n, false);
    else if (n.kind.equals("Index")) {
      if (!pointerLike(n.children.getFirst()))
        throw new UnsupportedIR(n, "Indexing requires a modeled pointer or array base.");
      var base = expression(n.children.get(0));
      var index = expression(n.children.get(1));
      if (!index.integerSafe()) throw new UnsupportedIR(n, "Array indexing requires a supported signed-int index.");
      emit("INDEX_ADDRESS", result, List.of(base.ref(), index.ref()), null, null, null, n, false);
    } else throw new UnsupportedIR(n, "Unsupported assignment/address target.");
    return new Value(result, false);
  }

  private long volatileReads(Node n) {
    if (n.kind.equals("Sizeof")) return 0;
    if (n.kind.equals("Unary") && n.text("operator").equals("&") && !n.children.isEmpty()) {
      Node operand = n.children.getFirst();
      if (operand.kind.equals("Identifier")) return 0;
      if (operand.kind.equals("Index")) return operand.children.stream().mapToLong(this::volatileReads).sum();
      if (operand.kind.equals("Unary") && operand.text("operator").equals("*"))
        return operand.children.stream().mapToLong(this::volatileReads).sum();
    }
    if ((n.kind.equals("Identifier") && n.text("type").contains("volatile")
            && ((Number) n.attributes.getOrDefault("pointerDepth", 0)).intValue() == 0
            && ((List<?>) n.attributes.getOrDefault("arrayDimensions", List.of())).isEmpty())
        || ((n.kind.equals("Index") || (n.kind.equals("Unary") && n.text("operator").equals("*")))
            && !n.children.isEmpty() && n.children.getFirst().text("type").contains("volatile"))) return 1;
    return n.children.stream().mapToLong(this::volatileReads).sum();
  }

  private boolean pointerLike(Node n) {
    return n.kind.equals("Identifier") && (((Number) n.attributes.getOrDefault("pointerDepth", 0)).intValue() > 0
        || !((List<?>) n.attributes.getOrDefault("arrayDimensions", List.of())).isEmpty());
  }

  private void validateWritable(Node n) {
    var info = symbolInfo.get(n.text("symbolId"));
    if (info == null || info.category().equals("FUNCTION") || info.category().equals("CONSTANT")
        || !info.arrayDimensions().isEmpty() || (info.pointerDepth() == 0 && info.type().contains("const")))
      throw new UnsupportedIR(n, "The target is not a supported writable scalar.");
  }

  private Value assign(Node n) {
    Node lhs = n.children.get(0), rhs = n.children.get(1);
    String op = n.text("operator");
    if (lhs.kind.equals("Identifier")
        && rhs.all().stream()
            .anyMatch(
                c ->
                    Set.of("Update", "Assignment").contains(c.kind)
                        && !c.children.isEmpty()
                        && c.children.getFirst().kind.equals("Identifier")
                        && c.children.getFirst().text("symbolId").equals(lhs.text("symbolId"))))
      throw new UnsupportedIR(
          n, "Repeated writes to the assignment target inside its value are not lowered.");
    if (!lhs.kind.equals("Identifier") && volatileReads(lhs) > 0 && volatileReads(rhs) > 0)
      throw new UnsupportedIR(n, "Unsequenced volatile reads across a memory target and value are not lowered.");
    if (!lhs.kind.equals("Identifier")
        && n.all().stream()
            .skip(1)
            .anyMatch(c -> Set.of("Call", "Update", "Assignment").contains(c.kind)))
      throw new UnsupportedIR(
          n,
          "Side effects combined with a computed memory assignment target have unspecified"
              + " evaluation order.");
    Value value = expression(rhs);
    if (lhs.kind.equals("Identifier")) {
      validateWritable(lhs);
      Value target = new Value(lhs.text("symbolId"), isInteger(lhs));
      if (!op.equals("=")) {
        if (!Set.of("+=", "-=", "*=", "/=", "%=").contains(op)
            || !target.integerSafe()
            || !value.integerSafe()) throw new UnsupportedIR(n, "Unsupported compound assignment.");
        Value prior = expression(lhs);
        String t = freshTemp();
        emit(
            "BINARY",
            t,
            List.of(prior.ref(), value.ref()),
            op.substring(0, 1),
            null,
            null,
            n,
            true);
        value = new Value(t, true);
      }
      emit(
          "ASSIGN",
          target.ref(),
          List.of(value.ref()),
          null,
          null,
          null,
          n,
          target.integerSafe() && value.integerSafe());
      return new Value(value.ref(), target.integerSafe() && value.integerSafe());
    }
    if (!op.equals("=")) throw new UnsupportedIR(n, "Compound memory assignments are not modeled.");
    Node base = lhs.kind.equals("Index") || lhs.kind.equals("Unary") ? lhs.children.getFirst() : lhs;
    if (base.text("type").contains("const")) throw new UnsupportedIR(n, "Writes through a const-qualified element are not permitted.");
    Value addr = address(lhs);
    emit("STORE", null, List.of(addr.ref(), value.ref()), null, null, null, n, false);
    return value;
  }

  private Value update(Node n) {
    Node operand = n.children.getFirst();
    if (!operand.kind.equals("Identifier"))
      throw new UnsupportedIR(n, "Only ordinary scalar increments are modeled.");
    validateWritable(operand);
    Value v = expression(operand);
    if (!v.integerSafe()) throw new UnsupportedIR(n, "Non-int increment is unsupported.");
    String old = freshTemp();
    emit("ASSIGN", old, List.of(v.ref()), null, null, null, n, true);
    String next = freshTemp();
    emit(
        "BINARY",
        next,
        List.of(old, "1"),
        n.text("operator").equals("++") ? "+" : "-",
        null,
        null,
        n,
        true);
    emit("ASSIGN", operand.text("symbolId"), List.of(next), null, null, null, n, true);
    return new Value(Boolean.TRUE.equals(n.attributes.get("postfix")) ? old : next, true);
  }

  private void condition(Node n, String yes, String no) {
    if (n.kind.equals("Binary") && n.text("operator").equals("&&")) {
      String next = freshLabel();
      condition(n.children.get(0), next, no);
      mark(next, n);
      condition(n.children.get(1), yes, no);
    } else if (n.kind.equals("Binary") && n.text("operator").equals("||")) {
      String next = freshLabel();
      condition(n.children.get(0), yes, next);
      mark(next, n);
      condition(n.children.get(1), yes, no);
    } else if (n.kind.equals("Unary") && n.text("operator").equals("!"))
      condition(n.children.getFirst(), no, yes);
    else {
      Value v = expression(n);
      emit("BRANCH", null, List.of(v.ref()), null, yes, no, n, v.integerSafe());
    }
  }

  private void emit(
      String op,
      String result,
      List<String> args,
      String operator,
      String target,
      String alternative,
      Node n,
      boolean safe) {
    code.add(
        new Instruction(
            n.id + ":i" + (serial++),
            op,
            result,
            List.copyOf(args),
            operator,
            target,
            alternative,
            n.range,
            safe,
            render(op, result, args, operator, target, alternative, display)));
  }

  public static String render(
      String op,
      String result,
      List<String> args,
      String operator,
      String target,
      String alternative,
      Map<String, String> names) {
    String dest = names.getOrDefault(result, result);
    List<String> a = args.stream().map(s -> names.getOrDefault(s, s)).toList();
    return switch (op) {
      case "DECLARE" -> "declare " + dest + " : " + a.getFirst();
      case "LABEL" -> target + ":";
      case "JUMP" -> "goto " + target;
      case "BRANCH" -> "if " + a.getFirst() + " goto " + target + " else " + alternative;
      case "RETURN" -> "return" + (a.isEmpty() ? "" : " " + a.getFirst());
      case "READ" -> dest + " = volatile_read " + a.getFirst();
      case "ASSIGN" -> dest + " = " + a.getFirst();
      case "BINARY" -> dest + " = " + a.get(0) + " " + operator + " " + a.get(1);
      case "UNARY" -> dest + " = " + operator + a.getFirst();
      case "CALL" ->
          dest + " = call " + a.getFirst() + "(" + String.join(", ", a.subList(1, a.size())) + ")";
      case "ADDRESS" -> dest + " = address " + a.getFirst();
      case "INDEX_ADDRESS" -> dest + " = element_address " + a.get(0) + "[" + a.get(1) + "]";
      case "LOAD" -> dest + " = load *" + a.getFirst();
      case "STORE" -> "store *" + a.get(0) + " = " + a.get(1);
      case "CAST" -> dest + " = cast<" + a.get(1) + "> " + a.get(0);
      case "SIZEOF" -> dest + " = sizeof " + a.getFirst();
      default -> op;
    };
  }
}
