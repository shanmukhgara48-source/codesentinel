package com.codesentinel;

import static org.junit.jupiter.api.Assertions.*;

import com.codesentinel.analysis.SymbolAnalyzer;
import com.codesentinel.parser.ParserAdapter;
import java.util.*;
import org.junit.jupiter.api.Test;

class SymbolTest {
  @Test
  void emptyAndUnnamedPointerPrototypesKeepTheirSignatures() {
    var r = analyze("int declared();int f(void){return declared();}");
    assertTrue(r.diagnostics().isEmpty(), r.diagnostics().toString());
    assertTrue(r.symbols().stream().filter(s -> s.name().equals("declared"))
        .allMatch(s -> s.category().equals("FUNCTION")));
    assertTrue(analyze("int f(int *);int f(int *p){return 0;}").diagnostics().isEmpty());
  }
  @Test
  void voidReturnChecksRespectPointersAndStorageSpecifiers() {
    assertTrue(analyze("void *f(void){return 0;}static void g(void){return;}").diagnostics().isEmpty());
    assertTrue(analyze("void *f(void){return;}").diagnostics().stream()
        .anyMatch(d -> d.code().equals("SEM-RETURN")));
  }

  @Test
  void blockPrototypesDoNotLeakIntoOtherScopes() {
    var r = analyze("int f(void){{int hidden(int x);hidden(1);}return hidden(1);}");
    assertEquals(1, r.diagnostics().size());
    assertEquals("SEM-UNDECLARED", r.diagnostics().getFirst().code());
    assertTrue(r.symbols().stream().filter(s -> s.name().equals("hidden"))
        .allMatch(s -> s.scope().contains("/block")));
  }
  SymbolAnalyzer.Result analyze(String source) {
    var p = new ParserAdapter().parse(source);
    assertTrue(p.valid(), p.diagnostics().toString());
    return new SymbolAnalyzer().analyze(p.ast(), Set.of());
  }

  @Test
  void nestedShadowingHasDistinctSymbols() {
    var r = analyze("int f(int a){ int x=2; {int x=3; a=x;} return x; }");
    assertEquals(2, r.symbols().stream().filter(s -> s.name().equals("x")).count());
    assertTrue(r.diagnostics().isEmpty(), r.diagnostics().toString());
  }

  @Test
  void undeclaredAndDuplicate() {
    var r = analyze("int f(void){int a=1; int a=2; return missing;}");
    assertEquals(
        Set.of("SEM-DUPLICATE", "SEM-UNDECLARED"),
        new HashSet<>(r.diagnostics().stream().map(d -> d.code()).toList()));
  }

  @Test
  void declarationBeforeUseAndScopeExit() {
    var r = analyze("int f(void){a=2; int a=1; {int b=2;} return b;}");
    assertEquals(2, r.diagnostics().size());
  }

  @Test
  void prototypesAgreeAndConflict() {
    assertTrue(
        analyze("int f(int a); int f(int b); int f(int a){return a;}").diagnostics().isEmpty());
    assertFalse(analyze("int f(int a); void f(int a);").diagnostics().isEmpty());
  }

  @Test
  void returnAndParameterScope() {
    var r = analyze("void f(int x){int x=2; return 1;}");
    assertEquals(2, r.diagnostics().size());
  }

  @Test
  void duplicateFunctionBodiesAreRejected() {
    assertTrue(
        analyze("int f(void){return 1;}int f(void){return 2;}").diagnostics().stream()
            .anyMatch(d -> d.code().equals("SEM-DUPLICATE-FUNCTION")));
  }

  @Test
  void supportedControlNodes() {
    var p =
        new ParserAdapter()
            .parse(
                "int f(void){for(int i=0;i<3;i++){if(i==2) break;} while(0){} do{}while(0); return"
                    + " 0;}");
    assertTrue(p.valid(), p.diagnostics().toString());
    assertTrue(
        p.ast().all().stream().noneMatch(n -> n.kind.equals("Unsupported")),
        p.ast().all().stream()
            .filter(n -> n.kind.equals("Unsupported"))
            .map(n -> n.attributes.toString())
            .toList()
            .toString());
  }
}
