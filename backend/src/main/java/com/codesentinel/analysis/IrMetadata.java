package com.codesentinel.analysis;

import com.codesentinel.model.Instruction;
import com.codesentinel.model.Instruction.*;
import java.util.*;

/** Conservative scalar effects. Memory contents are outside this value model. */
public class IrMetadata {
  public List<Instruction> annotate(List<Instruction> code, List<SymbolAnalyzer.Symbol> symbols) {
    Map<String, Operand> values = new HashMap<>();
    Set<String> exposed = new TreeSet<>();
    for (var s : symbols) {
      String type = s.type() + "*".repeat(s.pointerDepth())
          + (s.arrayDimensions().isEmpty() ? "" : "[" + String.join("][", s.arrayDimensions()) + "]");
      values.put(s.id(), new Operand(s.id(), Set.of("FUNCTION", "CONSTANT", "TYPE").contains(s.category()) ? s.category() : !s.arrayDimensions().isEmpty() ? "ARRAY_ADDRESS" : "SYMBOL",
          type, s.id(), s.scope(), s.type().contains("volatile")));
      if (s.scope().equals("global") && s.category().equals("VARIABLE") && s.arrayDimensions().isEmpty())
        exposed.add(s.id());
    }
    for (var i : code) if (i.op().equals("ADDRESS") && !i.args().isEmpty() && values.get(i.args().getFirst()) != null
        && values.get(i.args().getFirst()).kind().equals("SYMBOL")) exposed.add(i.args().getFirst());
    for (var i : code) if (i.result() != null && i.result().startsWith("%")) {
      String type = i.integerSafe() ? "signed int32" : switch (i.op()) {
        case "ADDRESS", "INDEX_ADDRESS" -> "address";
        case "SIZEOF" -> "size_t (symbolic)";
        case "CAST" -> i.args().get(1);
        default -> "unknown";
      };
      boolean volatileAddress = Set.of("ADDRESS", "INDEX_ADDRESS").contains(i.op())
          && !i.args().isEmpty() && values.containsKey(i.args().getFirst()) && values.get(i.args().getFirst()).volatileAccess();
      values.put(i.result(), new Operand(i.result(), "TEMPORARY", type, null, "temporary", volatileAddress));
    }
    List<Instruction> result = new ArrayList<>();
    for (var i : code) {
      boolean metadataOnly = Set.of("DECLARE", "SIZEOF", "CAST").contains(i.op());
      List<Operand> operands = new ArrayList<>();
      for (int j = 0; j < i.args().size(); j++) {
        String ref = i.args().get(j);
        operands.add((metadataOnly && (i.op().equals("DECLARE") || i.op().equals("SIZEOF") || j == 1))
            ? new Operand(ref, "TYPE", ref, null, null, false) : operand(ref, values));
      }
      Set<String> uses = new TreeSet<>(), defines = new TreeSet<>(), mayDefines = new TreeSet<>();
      if (!Set.of("DECLARE", "ADDRESS", "SIZEOF").contains(i.op()))
        for (var o : operands) if (Set.of("SYMBOL", "TEMPORARY").contains(o.kind())) uses.add(o.ref());
      Operand output = i.result() == null ? null : values.get(i.result());
      if (output != null && !output.kind().equals("ARRAY_ADDRESS")) defines.add(output.ref());
      boolean calls = i.op().equals("CALL"), load = Set.of("LOAD", "READ").contains(i.op()), store = i.op().equals("STORE");
      if (calls || load) uses.addAll(exposed);
      if (calls || store) mayDefines.addAll(exposed);
      boolean vol = i.op().equals("READ")
          || (i.op().equals("ASSIGN") && output != null && output.kind().equals("SYMBOL") && output.volatileAccess() && !output.type().contains("*"))
          || ((load || store) && operands.stream().anyMatch(Operand::volatileAccess));
      var effects = new Effects(List.copyOf(uses), List.copyOf(defines), List.copyOf(mayDefines),
          load || calls || vol, store || calls || (i.op().equals("ASSIGN") && output != null && (vol || output.storage().equals("global"))),
          calls, vol, calls || load || store || (i.op().equals("BINARY") && Set.of("+", "-", "*", "/", "%").contains(i.operator()))
              || (i.op().equals("UNARY") && "-".equals(i.operator())));
      result.add(new Instruction(i.id(), i.op(), i.result(), i.args(), i.operator(), i.target(), i.alternative(),
          i.range(), i.integerSafe(), i.text(), i.nodeId(), List.copyOf(operands), output, effects));
    }
    return List.copyOf(result);
  }

  private Operand operand(String ref, Map<String, Operand> values) {
    if (values.containsKey(ref)) return values.get(ref);
    String type = ref.matches("-?[0-9]+") ? "integer literal" : ref.contains("\"") ? "string literal" : "unmodeled literal";
    return new Operand(ref, "LITERAL", type, null, "literal", false);
  }
}
