package com.codesentinel.analysis;

import com.codesentinel.model.*;
import java.util.*;

public class CfgBuilder {
  public record Block(String id, String label, String kind, List<Instruction> instructions) {}

  public record Edge(String id, String source, String target, String kind, boolean backEdge) {}

  public record Graph(
      String functionId, String functionName, List<Block> nodes, List<Edge> edges) {}

  public List<Graph> build(List<TacGenerator.FunctionIR> functions) {
    return functions.stream().filter(f -> f.instructions() != null).map(this::graph).toList();
  }

  private Graph graph(TacGenerator.FunctionIR fn) {
    List<List<Instruction>> groups = new ArrayList<>();
    List<Instruction> current = new ArrayList<>();
    for (Instruction i : fn.instructions()) {
      if (i.op().equals("LABEL") && !current.isEmpty()) {
        groups.add(current);
        current = new ArrayList<>();
      }
      current.add(i);
      if (Set.of("JUMP", "BRANCH", "RETURN").contains(i.op())) {
        groups.add(current);
        current = new ArrayList<>();
      }
    }
    if (!current.isEmpty()) groups.add(current);
    List<Block> nodes = new ArrayList<>();
    List<Edge> edges = new ArrayList<>();
    Map<String, Integer> labels = new HashMap<>();
    String prefix = fn.id() + ":";
    nodes.add(new Block(prefix + "entry", "Entry", "ENTRY", List.of()));
    for (int j = 0; j < groups.size(); j++) {
      var instructions = groups.get(j);
      nodes.add(new Block(prefix + "b" + j, "B" + j, "BLOCK", instructions));
      for (var i : instructions) if (i.op().equals("LABEL")) labels.put(i.target(), j);
    }
    nodes.add(new Block(prefix + "exit", "Exit", "EXIT", List.of()));
    edge(
        edges,
        prefix + "entry",
        groups.isEmpty() ? prefix + "exit" : prefix + "b0",
        "ENTRY",
        false);
    for (int j = 0; j < groups.size(); j++) {
      String from = prefix + "b" + j;
      Instruction last = groups.get(j).getLast();
      if (last.op().equals("RETURN")) edge(edges, from, prefix + "exit", "RETURN", false);
      else if (last.op().equals("JUMP") || last.op().equals("BRANCH")) {
        int to = Objects.requireNonNull(labels.get(last.target()), "Missing TAC label");
        edge(edges, from, prefix + "b" + to, last.op().equals("BRANCH") ? "TRUE" : "JUMP", to <= j);
        if (last.op().equals("BRANCH")) {
          int alt = Objects.requireNonNull(labels.get(last.alternative()));
          edge(edges, from, prefix + "b" + alt, "FALSE", alt <= j);
        }
      } else
        edge(
            edges,
            from,
            j + 1 < groups.size() ? prefix + "b" + (j + 1) : prefix + "exit",
            "FALL_THROUGH",
            false);
    }
    // Keep disconnected blocks visible: no dead-code elimination is claimed.
    return new Graph(fn.id(), fn.name(), nodes, edges);
  }

  private void edge(List<Edge> edges, String source, String target, String kind, boolean back) {
    edges.add(new Edge("e" + edges.size(), source, target, kind, back));
  }
}
