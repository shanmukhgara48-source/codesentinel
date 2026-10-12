package com.codesentinel.analysis;

import com.codesentinel.model.*;
import java.util.*;

/** Two monotone may analyses over reachable blocks of ORIGINAL TAC, with synchronous rounds. */
public class DataFlowAnalyzer {
  public record Definition(String id, String value, String instructionId, SourceRange range, String kind) {}
  public record Sets(String blockId, List<String> in, List<String> out) {}
  public record Iteration(int round, List<Sets> changedBlocks) {}
  public record Analysis(String direction, String equation, int rounds, boolean converged,
      List<Sets> blocks, List<Iteration> trace, boolean traceTruncated) {}
  public record BlockFacts(String blockId, String label, boolean reachable, List<String> use,
      List<String> def, List<String> gen, List<String> kill) {}
  public record FunctionResult(String functionId, String functionName, String status, String reason,
      List<BlockFacts> blocks, List<Definition> definitions, Map<String, String> valueLabels,
      Analysis liveVariables, Analysis reachingDefinitions) {}

  private static final int MAX_BLOCKS = 256, MAX_DEFINITIONS = 1024, MAX_ROUNDS = 128;
  private static final int TRACE_CELLS = 50000, STATE_CELLS = 100000;

  public List<FunctionResult> analyze(List<TacGenerator.FunctionIR> functions, List<SymbolAnalyzer.Symbol> symbols) {
    Map<String, CfgBuilder.Graph> graphs = new HashMap<>();
    new CfgBuilder().build(functions).forEach(g -> graphs.put(g.functionId(), g));
    List<FunctionResult> result = new ArrayList<>();
    for (var fn : functions) {
      if (fn.instructions() == null) {
        result.add(unavailable(fn, "TAC is withheld for this function."));
        continue;
      }
      try { result.add(analyzeFunction(fn, graphs.get(fn.id()), symbols)); }
      catch (BudgetExceeded e) { result.add(unavailable(fn, e.getMessage())); }
    }
    return result;
  }

  private static class BudgetExceeded extends RuntimeException {
    BudgetExceeded(String message) { super(message); }
  }
  private FunctionResult unavailable(TacGenerator.FunctionIR fn, String reason) {
    return new FunctionResult(fn.id(), fn.name(), "SKIPPED", reason, List.of(), List.of(), Map.of(), null, null);
  }

  private FunctionResult analyzeFunction(TacGenerator.FunctionIR fn, CfgBuilder.Graph graph,
      List<SymbolAnalyzer.Symbol> symbols) {
    if (graph.nodes().size() > MAX_BLOCKS) throw new BudgetExceeded("Data flow limit: at most 256 CFG blocks per function.");
    Map<String, List<String>> successors = new LinkedHashMap<>(), predecessors = new LinkedHashMap<>();
    graph.nodes().forEach(b -> { successors.put(b.id(), new ArrayList<>()); predecessors.put(b.id(), new ArrayList<>()); });
    graph.edges().forEach(e -> { successors.get(e.source()).add(e.target()); predecessors.get(e.target()).add(e.source()); });
    Set<String> reachable = new HashSet<>();
    Deque<String> pending = new ArrayDeque<>(); pending.add(graph.nodes().getFirst().id());
    while (!pending.isEmpty()) { String id = pending.removeFirst(); if (reachable.add(id)) pending.addAll(successors.get(id)); }

    Map<String, String> labels = new TreeMap<>();
    symbols.forEach(s -> labels.put(s.id(), s.name() + "@" + s.id()));
    Map<String, Set<String>> use = empty(graph), def = empty(graph), gen = empty(graph), kill = empty(graph);
    Map<String, Set<String>> byValue = new TreeMap<>();
    List<Definition> definitions = new ArrayList<>();
    Set<String> used = new TreeSet<>();
    fn.instructions().forEach(i -> { used.addAll(i.effects().uses()); used.addAll(i.effects().defines()); used.addAll(i.effects().mayDefines()); });
    for (String value : used) {
      labels.putIfAbsent(value, value);
      if (!value.startsWith("%")) addDefinition(definitions, byValue,
          new Definition("entry:" + value, value, null, null, "ENTRY_UNKNOWN"));
    }
    for (var block : graph.nodes()) for (var i : block.instructions()) {
      for (String value : i.effects().defines()) addDefinition(definitions, byValue,
          new Definition(i.id() + ":" + value, value, i.id(), i.range(), i.op().equals("DECLARE") ? "UNINITIALIZED" : "WRITE"));
      for (String value : i.effects().mayDefines()) addDefinition(definitions, byValue,
          new Definition(i.id() + ":may:" + value, value, i.id(), i.range(), "MAY_WRITE"));
    }
    if (definitions.size() > MAX_DEFINITIONS) throw new BudgetExceeded("Data flow limit: at most 1,024 definitions per function.");
    String entry = graph.nodes().getFirst().id();
    definitions.stream().filter(d -> d.kind().equals("ENTRY_UNKNOWN")).forEach(d -> gen.get(entry).add(d.id()));
    for (var block : graph.nodes()) for (var i : block.instructions()) {
      for (String value : i.effects().uses()) if (!def.get(block.id()).contains(value)) use.get(block.id()).add(value);
      // May-writes cannot kill liveness or prior reaching definitions: the write might not happen.
      for (String value : i.effects().defines()) {
        def.get(block.id()).add(value);
        gen.get(block.id()).removeAll(byValue.get(value));
        kill.get(block.id()).addAll(byValue.get(value));
        gen.get(block.id()).add(i.id() + ":" + value);
      }
      for (String value : i.effects().mayDefines()) gen.get(block.id()).add(i.id() + ":may:" + value);
    }
    graph.nodes().forEach(b -> kill.get(b.id()).removeAll(gen.get(b.id())));
    Analysis live = solve(graph, reachable, successors, predecessors, use, def, true);
    Analysis reaching = solve(graph, reachable, successors, predecessors, gen, kill, false);
    List<BlockFacts> facts = graph.nodes().stream().map(b -> new BlockFacts(b.id(), b.label(), reachable.contains(b.id()),
        list(use.get(b.id())), list(def.get(b.id())), list(gen.get(b.id())), list(kill.get(b.id())))).toList();
    Map<String, String> relevantLabels = new TreeMap<>();
    used.forEach(v -> relevantLabels.put(v, labels.get(v)));
    return new FunctionResult(fn.id(), fn.name(), "COMPLETED", null, facts, definitions, relevantLabels, live, reaching);
  }

  private void addDefinition(List<Definition> definitions, Map<String, Set<String>> byValue, Definition d) {
    definitions.add(d); byValue.computeIfAbsent(d.value(), k -> new TreeSet<>()).add(d.id());
    if (definitions.size() > MAX_DEFINITIONS) throw new BudgetExceeded("Data flow limit: at most 1,024 definitions per function.");
  }
  private Map<String, Set<String>> empty(CfgBuilder.Graph graph) {
    Map<String, Set<String>> result = new LinkedHashMap<>(); graph.nodes().forEach(b -> result.put(b.id(), new TreeSet<>())); return result;
  }
  private List<String> list(Set<String> values) { return List.copyOf(values); }

  private Analysis solve(CfgBuilder.Graph graph, Set<String> reachable, Map<String, List<String>> successors,
      Map<String, List<String>> predecessors, Map<String, Set<String>> generate, Map<String, Set<String>> remove, boolean backward) {
    Map<String, Set<String>> in = empty(graph), out = empty(graph);
    List<Iteration> trace = new ArrayList<>();
    int traceCells = 0; boolean truncated = false;
    for (int round = 1; round <= MAX_ROUNDS; round++) {
      Map<String, Set<String>> nextIn = empty(graph), nextOut = empty(graph);
      List<Sets> changed = new ArrayList<>();
      int stateCells = 0;
      for (var block : graph.nodes()) {
        String id = block.id();
        if (!reachable.contains(id)) continue;
        Set<String> joined = new TreeSet<>();
        for (String neighbor : (backward ? successors : predecessors).get(id))
          if (reachable.contains(neighbor)) joined.addAll((backward ? in : out).get(neighbor));
        Set<String> transfer = new TreeSet<>(joined); transfer.removeAll(remove.get(id)); transfer.addAll(generate.get(id));
        nextIn.put(id, backward ? transfer : joined); nextOut.put(id, backward ? joined : transfer);
        stateCells += nextIn.get(id).size() + nextOut.get(id).size();
        if (stateCells > STATE_CELLS) throw new BudgetExceeded("Data flow state exceeded 100,000 set entries; no incomplete fixed point is published.");
        if (!nextIn.get(id).equals(in.get(id)) || !nextOut.get(id).equals(out.get(id)))
          changed.add(new Sets(id, list(nextIn.get(id)), list(nextOut.get(id))));
      }
      int cells = changed.stream().mapToInt(s -> 1 + s.in().size() + s.out().size()).sum();
      if (!truncated && traceCells + cells <= TRACE_CELLS) { trace.add(new Iteration(round, List.copyOf(changed))); traceCells += cells; }
      else truncated = true;
      in = nextIn; out = nextOut;
      if (changed.isEmpty()) {
        List<Sets> finalSets = new ArrayList<>();
        for (var block : graph.nodes()) finalSets.add(new Sets(block.id(), list(in.get(block.id())), list(out.get(block.id()))));
        return new Analysis(backward ? "BACKWARD" : "FORWARD", backward
            ? "OUT[B] = union IN[successors]; IN[B] = USE[B] union (OUT[B] - DEF[B])"
            : "IN[B] = union OUT[predecessors]; OUT[B] = GEN[B] union (IN[B] - KILL[B])",
            round, true, finalSets, trace, truncated);
      }
    }
    throw new BudgetExceeded("Data flow did not converge within 128 rounds; no incomplete IN/OUT sets are published.");
  }
}
