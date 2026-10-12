package com.codesentinel;

import static org.junit.jupiter.api.Assertions.*;
import com.codesentinel.analysis.*;
import com.fasterxml.jackson.databind.*;
import org.junit.jupiter.api.Test;

class ReliabilityTest {
  private JsonNode analyze(String source) {
    return new ObjectMapper().valueToTree(new AnalysisService(new ObjectMapper(), 1024).analyze(source, "lesson.c"));
  }

  @Test void discardedVolatileReadsAreRetained() {
    var r = analyze("int f(void){volatile int v=2;v;return v+1;}");
    var instructions = r.path("modules").path("tac").path("data").get(0).path("instructions");
    long reads = java.util.stream.StreamSupport.stream(instructions.spliterator(), false)
        .filter(i -> i.path("op").asText().equals("READ")).count();
    assertEquals(2, reads, "Both discarded and consumed volatile reads are observable");
  }

  @Test void sizeofDoesNotInventExecutedCallsOrResourceSites() {
    var r = analyze("#include <stdlib.h>\n#include <stdio.h>\nint f(void){char b[16];sizeof(gets(b));sizeof(malloc(8));return 0;}");
    assertEquals(0, r.path("modules").path("security").path("data").size());
    assertEquals(0, r.path("modules").path("resources").path("data").path("allocationCalls").asInt());
  }

  @Test void globalSemanticErrorsWithholdAllDependentIr() {
    var r = analyze("int f(int x);void f(int x);int f(int x){return x;}");
    assertEquals("SKIPPED", r.path("modules").path("tac").path("data").get(0).path("status").asText());
  }

  @Test void unevaluatedFreeCannotSuppressAReleaseWarning() {
    var r = analyze("#include <stdlib.h>\nint f(void){char*p=malloc(8);if(!p)return 1;sizeof(free(p));return 0;}");
    assertTrue(java.util.stream.StreamSupport.stream(r.path("findings").spliterator(), false).anyMatch(f -> f.path("ruleId").asText().equals("CS-RES-002")));
    assertEquals(0, r.path("modules").path("resources").path("data").path("deallocationCalls").asInt());
  }

  @Test void scansetsHaveTheSameCapacityBoundaryAsStrings() {
    assertTrue(SecurityAnalyzer.unboundedString("%[a-z]"));
    assertTrue(SecurityAnalyzer.unboundedString("%0[^ ]"));
    assertFalse(SecurityAnalyzer.unboundedString("%15[^ ]"));
    assertFalse(SecurityAnalyzer.unboundedString("%*[a-z]"));
  }

  @Test void binarySourceRangesEndAtTheirOwnOperand() {
    String source = "int f(void){return 1+2+3;}";
    var nodes = new com.codesentinel.parser.ParserAdapter().parse(source).ast().all();
    var inner = nodes.stream().filter(n -> n.kind.equals("Binary") && n.children.getLast().text("value").equals("2")).findFirst().orElseThrow();
    assertEquals("1+2", source.substring(inner.range.startOffset(), inner.range.endOffset()));
  }

  @Test void fallthroughHasAnExplicitBoundary() {
    var r = analyze("int f(int c){if(c)return 1;}");
    assertEquals("SKIPPED", r.path("modules").path("tac").path("data").get(0).path("status").asText());
    var main = analyze("int main(void){}");
    assertEquals("return 0", main.path("modules").path("tac").path("data").get(0).path("instructions").get(0).path("text").asText());
  }

  @Test void qualifiedPointersAreDisclosedAndVolatilePointeeEffectsRemain() {
    var r = analyze("int f(void){int *volatile p;return 0;}");
    assertEquals("SKIPPED", r.path("modules").path("tac").path("data").get(0).path("status").asText());
    var load = analyze("int f(volatile int *p){return p[0];}").path("modules").path("tac").path("data").get(0).path("instructions");
    assertTrue(java.util.stream.StreamSupport.stream(load.spliterator(), false).anyMatch(i -> i.path("op").asText().equals("LOAD") && i.path("effects").path("volatileAccess").asBoolean()));
  }

  @Test void invalidTargetsAndCallsNeverPublishCompleteTac() {
    for (String source : java.util.List.of("int f(void){int x=1;return x();}",
        "int f(void){int a[3];a=0;return 0;}", "int f(void){const int x=1;x=2;return x;}",
        "int f(void){volatile int v=1;return v+v;}", "int f(volatile int*p){return *p+*p;}", "int f(void){*1=0;return 0;}", "int f(const int *p){*p=1;return 0;}", "int f(void){return *1;}", "int f(int x){return x[0];}", "int f(int *p){return -p;}")) {
      var r = analyze(source);
      assertEquals("SKIPPED", r.path("modules").path("tac").path("data").get(0).path("status").asText(), source);
    }
  }
}
