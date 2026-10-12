package com.codesentinel;

import static org.junit.jupiter.api.Assertions.*;
import com.codesentinel.analysis.*;
import com.codesentinel.parser.ParserAdapter;
import java.util.*;
import org.junit.jupiter.api.Test;

class DataFlowTest {
  record Pipeline(DataFlowAnalyzer.FunctionResult flow, CfgBuilder.Graph graph, List<com.codesentinel.model.Instruction> code) {}
  private Pipeline analyze(String source) {
    var parsed = new ParserAdapter().parse(source);
    assertTrue(parsed.valid(), parsed.diagnostics().toString());
    var symbols = new SymbolAnalyzer().analyze(parsed.ast(), Set.of());
    var ir = new TacGenerator().generate(parsed.ast(), symbols.symbols(), symbols.diagnostics());
    var flow = new DataFlowAnalyzer().analyze(ir, symbols.symbols()).getLast();
    assertEquals("COMPLETED", flow.status(), flow.reason());
    return new Pipeline(flow, new CfgBuilder().build(ir).getLast(), ir.getLast().instructions());
  }
  private Set<String> set(List<String> values) { return new HashSet<>(values); }
  private Map<String, DataFlowAnalyzer.Sets> sets(DataFlowAnalyzer.Analysis a) {
    Map<String, DataFlowAnalyzer.Sets> result = new HashMap<>(); a.blocks().forEach(s -> result.put(s.blockId(), s)); return result;
  }

  @Test void bothAnalysesSatisfyTheirEquationsOnBranchAndLoop() {
    var p = analyze("int f(int c){int x=0;while(c){if(x<2)x=1;else x=3;c=c-1;}return x;}");
    var live = sets(p.flow.liveVariables()); var rd = sets(p.flow.reachingDefinitions());
    for (var b : p.flow.blocks()) {
      Set<String> liveOut = new HashSet<>(), rdIn = new HashSet<>();
      if (b.reachable()) for (var e : p.graph.edges()) {
        var from = p.flow.blocks().stream().filter(f -> f.blockId().equals(e.source())).findFirst().orElseThrow();
        if (e.source().equals(b.blockId())) liveOut.addAll(live.get(e.target()).in());
        if (e.target().equals(b.blockId()) && from.reachable()) rdIn.addAll(rd.get(e.source()).out());
      }
      Set<String> liveIn = new HashSet<>(liveOut); liveIn.removeAll(b.def());
      Set<String> rdOut = new HashSet<>(rdIn); rdOut.removeAll(b.kill());
      if (b.reachable()) { liveIn.addAll(b.use()); rdOut.addAll(b.gen()); }
      assertEquals(liveOut, set(live.get(b.blockId()).out()));
      assertEquals(liveIn, set(live.get(b.blockId()).in()));
      assertEquals(rdIn, set(rd.get(b.blockId()).in()));
      assertEquals(rdOut, set(rd.get(b.blockId()).out()));
    }
    assertTrue(p.flow.liveVariables().rounds() > 2);
    assertTrue(p.flow.reachingDefinitions().rounds() > 2);
    assertTrue(p.flow.liveVariables().trace().getLast().changedBlocks().isEmpty());
    assertTrue(p.flow.reachingDefinitions().trace().getLast().changedBlocks().isEmpty());
  }

  @Test void branchJoinContainsBothDefinitionsOfX() {
    var p = analyze("int f(int c){int x;if(c)x=1;else x=2;return x;}");
    var ret = p.graph.nodes().stream().filter(b -> b.instructions().stream().anyMatch(i -> i.op().equals("RETURN") && !i.args().isEmpty())).findFirst().orElseThrow();
    String x = ret.instructions().stream().filter(i -> i.op().equals("RETURN")).findFirst().orElseThrow().args().getFirst();
    var incoming = sets(p.flow.reachingDefinitions()).get(ret.id()).in();
    assertEquals(2, p.flow.definitions().stream().filter(d -> d.value().equals(x) && incoming.contains(d.id())).count());
  }

  @Test void unreachableWritesCannotReachReturnAndReadsAreNotLive() {
    var p = analyze("int f(int c){int x=1;return x;x=9;return c;}");
    for (var b : p.flow.blocks()) if (!b.reachable()) {
      assertTrue(sets(p.flow.liveVariables()).get(b.blockId()).in().isEmpty());
      assertTrue(sets(p.flow.reachingDefinitions()).get(b.blockId()).out().isEmpty());
    }
    assertFalse(p.flow.blocks().stream().filter(DataFlowAnalyzer.BlockFacts::reachable)
        .flatMap(b -> sets(p.flow.liveVariables()).get(b.blockId()).in().stream()).anyMatch(v -> p.flow.valueLabels().get(v).startsWith("c@")));
  }

  @Test void memoryMayWritesPreservePriorDefinitionsAndCallsAreEffects() {
    var p = analyze("int g;void side(void){}int f(void){g=1;side();return g;}");
    var call = p.code.stream().filter(i -> i.op().equals("CALL")).findFirst().orElseThrow();
    assertTrue(call.effects().calls()); assertFalse(call.effects().mayDefines().isEmpty());
    String g = call.effects().mayDefines().getFirst();
    var exit = sets(p.flow.reachingDefinitions()).get(p.graph.nodes().getLast().id()).in();
    assertTrue(p.flow.definitions().stream().anyMatch(d -> d.value().equals(g) && d.kind().equals("WRITE") && exit.contains(d.id())));
    assertTrue(p.flow.definitions().stream().anyMatch(d -> d.value().equals(g) && d.kind().equals("MAY_WRITE") && exit.contains(d.id())));
  }

  @Test void arraysAreAddressesAndDeclarationsAreNotVolatileWrites() {
    var p = analyze("int f(void){volatile int x;int a[3];a[0]=1;return a[0];}");
    var decl = p.code.stream().filter(i -> i.op().equals("DECLARE") && i.output().volatileAccess()).findFirst().orElseThrow();
    assertFalse(decl.effects().writesMemory()); assertFalse(decl.effects().volatileAccess());
    assertTrue(p.code.stream().flatMap(i -> i.operands().stream()).anyMatch(o -> o.kind().equals("ARRAY_ADDRESS")));
    assertFalse(p.flow.valueLabels().values().stream().anyMatch(v -> v.startsWith("a@")));
    var parsed = new ParserAdapter().parse("int f(int*p){if(p==NULL)return 0;return 1;}");
    var symbols = new SymbolAnalyzer().analyze(parsed.ast(), Set.of("stddef.h"));
    var ir = new TacGenerator().generate(parsed.ast(), symbols.symbols(), symbols.diagnostics());
    var flow = new DataFlowAnalyzer().analyze(ir, symbols.symbols()).getFirst();
    assertFalse(flow.valueLabels().containsKey("lib:NULL"), "Catalog constants are not live scalar inputs");
  }

  @Test void typedMetadataAndAstIdsSurviveRewrites() {
    var parsed = new ParserAdapter().parse("int f(void){int a=2*3;return a;}");
    var symbols = new SymbolAnalyzer().analyze(parsed.ast(), Set.of());
    var code = new Optimizer().optimize(new TacGenerator().generate(parsed.ast(), symbols.symbols(), symbols.diagnostics()), symbols.symbols()).functions().getFirst().instructions();
    Set<String> ids = new HashSet<>(); parsed.ast().all().forEach(n -> ids.add(n.id));
    for (var i : code) {
      assertTrue(ids.contains(i.nodeId())); assertNotNull(i.effects()); assertEquals(i.args().size(), i.operands().size());
      for (int j=0;j<i.args().size();j++) assertEquals(i.args().get(j), i.operands().get(j).ref());
    }
    assertTrue(code.getLast().operands().getFirst().kind().equals("LITERAL"));
  }

  @Test void boundedAnalysisPublishesNoPartialFixedPoint() {
    var parsed = new ParserAdapter().parse("int f(int x){" + "if(x)x=1;".repeat(90) + "return x;}");
    var symbols = new SymbolAnalyzer().analyze(parsed.ast(), Set.of());
    var flow = new DataFlowAnalyzer().analyze(new TacGenerator().generate(parsed.ast(), symbols.symbols(), symbols.diagnostics()), symbols.symbols()).getFirst();
    assertEquals("SKIPPED", flow.status()); assertNull(flow.liveVariables()); assertNull(flow.reachingDefinitions());
    assertTrue(flow.reason().contains("256"));
    var report = new AnalysisService(new com.fasterxml.jackson.databind.ObjectMapper(), 1024)
        .analyze("int f(int x){" + "if(x)x=1;".repeat(90) + "return x;}", "large.c");
    assertEquals("PARTIAL_ANALYSIS", report.get("status"));
  }
}
