package com.codesentinel;

import static org.junit.jupiter.api.Assertions.*;

import com.codesentinel.analysis.*;
import com.codesentinel.model.*;
import com.codesentinel.parser.ParserAdapter;
import java.util.*;
import org.junit.jupiter.api.Test;

class CompilerTest {
  @Test
  void persistentLocalsAndWiderIntegerArithmeticAreWithheld() {
    for (String source : List.of("int f(void){static int x=1;return x++;}",
        "int f(void){return 2147483648-1;}"))
      assertEquals("SKIPPED", analyze(source).ir().getFirst().status());
  }
  @Test
  void octalLiteralIsNotFoldedAsDecimal() {
    var p = analyze("int f(void){return 010+1;}");
    assertEquals("SKIPPED", p.ir().getFirst().status());
    assertNull(p.ir().getFirst().instructions());
  }

  @Test
  void pointerElementsAreNotTreatedAsSignedIntegers() {
    for (String source : List.of("int f(int **p){return *p+1;}",
        "int f(void){int *a[4];return a[0]+1;}")) {
      var p = analyze(source);
      assertEquals("SKIPPED", p.ir().getFirst().status());
      assertNull(p.ir().getFirst().instructions());
    }
    assertEquals("COMPLETED", analyze("int f(int *p){return *p+1;}").ir().getFirst().status());
  }
  @Test
  void repeatedAssignmentWritesDoNotChooseUndefinedOrdering() {
    var p = analyze("int f(void){int x=1;x=x++;return x;}");
    assertEquals("SKIPPED", p.ir().getFirst().status());
    assertNull(p.ir().getFirst().instructions());
  }

  @Test
  void effectfulMemoryAssignmentsDoNotChooseUnspecifiedOrdering() {
    var p =
        analyze("int side(void){return 1;}int f(void){int a[4];int i=0;a[i++]=side();return 0;}");
    assertEquals("SKIPPED", p.ir().get(1).status());
    assertNull(p.ir().get(1).instructions());
  }

  record Pipeline(
      List<TacGenerator.FunctionIR> ir,
      Optimizer.Result optimized,
      List<CfgBuilder.Graph> graphs) {}

  Pipeline analyze(String source) {
    var p = new ParserAdapter().parse(source);
    assertTrue(p.valid(), p.diagnostics().toString());
    var s = new SymbolAnalyzer().analyze(p.ast(), Set.of());
    var ir = new TacGenerator().generate(p.ast(), s.symbols(), s.diagnostics());
    var o = new Optimizer().optimize(ir, s.symbols());
    return new Pipeline(ir, o, new CfgBuilder().build(o.functions()));
  }

  @Test
  void arithmeticBecomesTwentyThroughTwoPasses() {
    var p = analyze("int f(void){int a=2*8+1;int b=a+3;return b;}");
    assertEquals("COMPLETED", p.ir().getFirst().status());
    assertEquals("return 20", p.optimized().functions().getFirst().instructions().getLast().text());
    assertEquals(
        Set.of("CONSTANT_FOLDING", "CONSTANT_PROPAGATION"),
        new HashSet<>(p.optimized().changes().stream().map(c -> c.pass()).toList()));
    assertEquals(p.optimized().beforeCount(), p.optimized().afterCount());
  }

  @Test
  void branchesDoNotPropagateAcrossJoin() {
    var p = analyze("int f(int c){int x=1;if(c){x=2;}return x;}");
    assertTrue(
        p.optimized().functions().getFirst().instructions().stream()
            .filter(i -> i.op().equals("RETURN"))
            .allMatch(i -> i.text().contains("x@")));
    assertTrue(p.graphs().getFirst().edges().stream().anyMatch(e -> e.kind().equals("FALSE")));
  }

  @Test
  void loopValuesStayVariableAndContinueHasUpdateTarget() {
    var p = analyze("int f(void){int x=0;for(int i=0;i<4;i++){if(i==2)continue;x+=i;}return x;}");
    assertEquals(
        "COMPLETED", p.ir().getFirst().status(), p.ir().getFirst().diagnostics().toString());
    assertTrue(p.graphs().getFirst().edges().stream().anyMatch(CfgBuilder.Edge::backEdge));
    assertTrue(
        p.optimized().functions().getFirst().instructions().stream()
            .anyMatch(i -> i.op().equals("BINARY") && i.text().contains("i@")));
  }

  @Test
  void unsafeArithmeticStaysUnfolded() {
    var p = analyze("int f(void){int a=2147483647+1;int b=1/0;return 0;}");
    assertEquals(2, p.optimized().diagnostics().size());
    assertTrue(
        p.optimized().functions().getFirst().instructions().stream()
            .anyMatch(i -> i.op().equals("BINARY") && i.operator().equals("/")));
  }

  @Test
  void shortCircuitPlacesCallBehindBranch() {
    var p = analyze("int side(void){return 1;}int f(int c){if(c && side())return 1;return 0;}");
    var code = p.ir().get(1).instructions();
    int call = -1, branch = -1;
    for (int i = 0; i < code.size(); i++) {
      if (code.get(i).op().equals("CALL")) call = i;
      if (branch < 0 && code.get(i).op().equals("BRANCH")) branch = i;
    }
    assertTrue(branch >= 0 && call > branch);
  }

  @Test
  void unsupportedControlHasNoInventedTac() {
    var p = analyze("int f(int c){switch(c){case 1:return 1;default:return 0;}}");
    assertEquals("SKIPPED", p.ir().getFirst().status());
    assertNull(p.ir().getFirst().instructions());
    assertTrue(p.graphs().isEmpty());
  }

  @Test
  void callsInvalidateKnownValues() {
    var p = analyze("int side(void){return 0;}int f(void){int x=2;side();return x;}");
    assertTrue(p.optimized().functions().get(1).instructions().getLast().text().contains("x@"));
  }

  @Test
  void memoryWritesPreserveVariableLoads() {
    var p = analyze("int f(void){int x=2;int*p=&x;*p=3;return x+1;}");
    assertEquals("COMPLETED", p.ir().getFirst().status());
    assertTrue(
        p.optimized().functions().getFirst().instructions().stream()
            .anyMatch(i -> i.op().equals("BINARY") && i.text().contains("x@")));
  }

  @Test
  void intArrayLoadsHaveRealTac() {
    var p = analyze("int f(void){int a[4];a[0]=2;return a[0]+1;}");
    assertEquals("COMPLETED", p.ir().getFirst().status());
    assertTrue(p.ir().getFirst().instructions().stream().anyMatch(i -> i.op().equals("LOAD")));
    assertTrue(p.ir().getFirst().instructions().stream().anyMatch(i -> i.op().equals("STORE")));
  }

  @Test
  void volatileReadsRemainExplicit() {
    var p = analyze("int f(void){volatile int v=2;return v+1;}");
    assertEquals("COMPLETED", p.ir().getFirst().status());
    assertTrue(
        p.optimized().functions().getFirst().instructions().stream()
            .anyMatch(i -> i.text().contains("v@") && i.op().equals("READ")));
  }

  @Test
  void sizeofDoesNotLowerOperandSideEffects() {
    var p = analyze("int f(void){int a=1;sizeof(a++);return a;}");
    assertEquals("COMPLETED", p.ir().getFirst().status());
    assertEquals(
        1,
        p.ir().getFirst().instructions().stream()
            .filter(i -> i.op().equals("ASSIGN") && i.result().startsWith("s"))
            .count());
  }

  @Test
  void reassignmentUpdatesOnlyTheCurrentBlockBinding() {
    var p = analyze("int f(void){int x=1;x=4;return x+2;}");
    assertEquals("return 6", p.optimized().functions().getFirst().instructions().getLast().text());
  }

  @Test
  void nestedBreakAndContinueHaveDistinctCorrectLoopTargets() {
    String source =
        "int f(void){for(int i=0;i<2;i++){for(int j=0;j<2;j++){continue;break;}continue;}return"
            + " 0;}";
    var code = analyze(source).ir().getFirst().instructions();
    var inner =
        code.stream()
            .filter(
                i ->
                    i.op().equals("JUMP") && i.range().startOffset() == source.indexOf("continue;"))
            .findFirst()
            .orElseThrow();
    var outer =
        code.stream()
            .filter(
                i ->
                    i.op().equals("JUMP")
                        && i.range().startOffset() == source.lastIndexOf("continue;"))
            .findFirst()
            .orElseThrow();
    var stop =
        code.stream()
            .filter(
                i -> i.op().equals("JUMP") && i.range().startOffset() == source.indexOf("break;"))
            .findFirst()
            .orElseThrow();
    assertNotEquals(inner.target(), outer.target());
    assertNotEquals(inner.target(), stop.target());
    int innerLabel = 0, outerLabel = 0;
    for (int i = 0; i < code.size(); i++)
      if (code.get(i).op().equals("LABEL")) {
        if (code.get(i).target().equals(inner.target())) innerLabel = i;
        if (code.get(i).target().equals(outer.target())) outerLabel = i;
      }
    assertTrue(code.get(innerLabel + 1).text().contains("j@"));
    assertTrue(code.get(outerLabel + 1).text().contains("i@"));
    assertTrue(
        code.stream().anyMatch(i -> i.op().equals("LABEL") && i.target().equals(stop.target())));
  }

  @Test
  void logicalOrRoutesTheFalseEdgeToItsCall() {
    var p = analyze("int side(void){return 1;}int f(int c){if(c || side())return 1;return 0;}");
    var code = p.ir().get(1).instructions();
    var first = code.getFirst();
    assertEquals("BRANCH", first.op());
    assertEquals("LABEL", code.get(1).op());
    assertEquals(first.alternative(), code.get(1).target());
    assertEquals("CALL", code.get(2).op());
  }
}
