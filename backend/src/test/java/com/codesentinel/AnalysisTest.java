package com.codesentinel;

import static org.junit.jupiter.api.Assertions.*;

import com.codesentinel.analysis.*;
import com.fasterxml.jackson.databind.*;
import java.nio.file.*;
import java.util.*;
import org.junit.jupiter.api.*;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;

class AnalysisTest {
  @Test
  void longCredentialsAreRedactedBeforeExcerptTruncation() {
    var r = analyze("int f(void){char *password=\"PRIVATE_PREFIX_" + "q".repeat(300) + "\";return 0;}");
    assertFalse(r.toString().contains("PRIVATE_PREFIX_"));
    assertTrue(r.path("findings").get(0).path("excerpt").asText().contains("REDACTED"));
  }
  @Test
  void unterminatedCredentialDoesNotLeakThroughLexerDiagnostic() {
    var r = analyze("int f(void){char *password=\"PRIVATE_UNTERMINATED_VALUE");
    assertEquals("PARSE_ERROR", r.path("status").asText());
    assertFalse(r.toString().contains("PRIVATE_UNTERMINATED_VALUE"));
  }

  @Test
  void mutuallyExclusiveBranchesDoNotInventInputProvenance() {
    var r =
        analyze(
            "#include <stdio.h>\n"
                + "#include <stdlib.h>\n"
                + "int f(int c){char b[32];if(c){scanf(\"%31s\",b);}else{system(b);}return 0;}");
    assertFalse(rules(r).contains("CS-SEC-006"));
    assertTrue(rules(r).contains("CS-SEC-007"));
  }

  @Test
  void opaqueCustomLibraryNameStillEscapesOwnership() {
    var r =
        analyze(
            "#include <stdlib.h>\n"
                + "void printf(char *p){}int f(void){char *p=malloc(32);printf(p);return 0;}");
    assertEquals(
        "ESCAPED_OR_UNKNOWN",
        r.path("modules")
            .path("resources")
            .path("data")
            .path("allocations")
            .get(0)
            .path("ownership")
            .asText());
    assertFalse(rules(r).contains("CS-RES-002"));
  }

  @Test
  void globalFixedArraysUseTheElementThreshold() {
    var r = analyze("int storage[2048];int f(void){return 0;}");
    assertTrue(rules(r).contains("CS-RES-004"));
    assertEquals(
        "global",
        r.path("modules")
            .path("resources")
            .path("data")
            .path("findings")
            .get(0)
            .path("functionName")
            .asText());
  }

  final ObjectMapper mapper = new ObjectMapper();
  final AnalysisService service = new AnalysisService(mapper, 1024);

  JsonNode analyze(String code) {
    return mapper.valueToTree(service.analyze(code, "../input.c"));
  }

  JsonNode sample(String name) throws Exception {
    return analyze(Files.readString(Path.of("../samples/" + name + ".c")));
  }

  Set<String> rules(JsonNode r) {
    Set<String> out = new HashSet<>();
    r.path("findings").forEach(f -> out.add(f.path("ruleId").asText()));
    return out;
  }

  @Test
  void heroFlowsThroughAllCoreModules() throws Exception {
    var r = sample("hero");
    assertEquals("SUCCESS_WITH_WARNINGS", r.path("status").asText(), r.toPrettyString());
    for (String key :
        List.of(
            "tokens",
            "ast",
            "symbols",
            "semantics",
            "tac",
            "optimization",
            "cfg",
            "security",
            "resources",
            "performance",
            "duplication"))
      assertEquals("COMPLETED", r.path("modules").path(key).path("status").asText(), key);
    assertEquals(Set.of("CS-SEC-005", "CS-SEC-002"), rules(r));
    assertTrue(r.path("summary").path("optimizationCount").asInt() > 0);
    assertEquals(
        1, r.path("modules").path("resources").path("data").path("allocationCalls").asInt());
  }

  @Test
  void scanfBoundedSuppressedAndEscapedFormats() {
    for (String fmt : List.of("%15s", "%*s", "%%s"))
      assertFalse(
          rules(
                  analyze(
                      "#include <stdio.h>\nint f(void){char b[16];scanf(\""
                          + fmt
                          + "\",b);return 0;}"))
              .contains("CS-SEC-005"),
          fmt);
    assertTrue(
        rules(analyze("#include <stdio.h>\nint f(void){char b[16];scanf(\"%s\",b);return 0;}"))
            .contains("CS-SEC-005"));
  }

  @Test
  void commentsAndStringsAreNotCalls() {
    var r =
        analyze(
            "#include <stdio.h>\n"
                + "int f(void){/* gets(buffer); */ char *s=\"strcpy(buffer,input)\";return 0;}");
    assertTrue(rules(r).isEmpty());
  }

  @Test
  void suppressedAndEscapedConversionsDoNotInventCommandInput() {
    for (String fmt : List.of("%*s", "%%s")) {
      var r =
          analyze(
              "#include <stdio.h>\n#include <stdlib.h>\nint f(void){char b[32];scanf(\""
                  + fmt
                  + "\",b);system(b);return 0;}");
      assertFalse(rules(r).contains("CS-SEC-006"));
      assertTrue(rules(r).contains("CS-SEC-007"));
    }
  }

  @Test
  void zeroWidthDoesNotClaimBoundedStringInput() {
    assertTrue(SecurityAnalyzer.unboundedString("%0s"));
  }

  @Test
  void customLibraryNamesAreNotLibraryRules() {
    var r =
        analyze("#include <string.h>\nint strcpy(int x){return x;}int f(void){return strcpy(3);}");
    assertFalse(rules(r).contains("CS-SEC-002"));
  }

  @Test
  void localCommandProvenance() {
    assertTrue(
        rules(
                analyze(
                    "#include <stdio.h>\n"
                        + "#include <stdlib.h>\n"
                        + "int f(void){char b[32];char *c;scanf(\"%31s\",b);c=b;system(c);return"
                        + " 0;}"))
            .contains("CS-SEC-006"));
    assertFalse(
        rules(analyze("#include <stdlib.h>\nint f(void){system(\"echo hello\");return 0;}"))
            .contains("CS-SEC-006"));
  }

  @Test
  void checkedFreedAndEscapedAllocationsDoNotGetLocalWarnings() {
    var r =
        analyze(
            "#include <stdlib.h>\n"
                + "char *f(void){char *p=malloc(32);return p;}int"
                + " g(void){char*p=malloc(32);if(!p)return 1;free(p);return 0;}");
    assertFalse(rules(r).contains("CS-RES-001"));
    assertFalse(rules(r).contains("CS-RES-002"));
  }

  @Test
  void resourceSitesAndThreshold() throws Exception {
    var r = sample("resources");
    assertTrue(
        rules(r).containsAll(Set.of("CS-RES-001", "CS-RES-002", "CS-RES-003", "CS-RES-004")));
    assertEquals(
        4, r.path("modules").path("resources").path("data").path("allocationCalls").asInt());
    assertEquals(
        1, r.path("modules").path("resources").path("data").path("allocationsInsideLoops").asInt());
  }

  @Test
  void complexityMatchesDefinition() {
    var r = analyze("int f(int a,int b){if(a&&b){while(a){a--;}}return 0;}");
    assertEquals(
        4,
        r.path("modules")
            .path("performance")
            .path("data")
            .path("functions")
            .get(0)
            .path("cyclomaticComplexity")
            .asInt());
    assertEquals(2, r.path("modules").path("performance").path("data").path("maxNesting").asInt());
  }

  @Test
  void castAllocationStillMatchesGuardAndRelease() {
    var r =
        analyze(
            "#include <stdlib.h>\n"
                + "int f(void){char*p=(char*)malloc(32);if(!p)return 1;free(p);return 0;}");
    assertFalse(rules(r).contains("CS-RES-001"));
    assertFalse(rules(r).contains("CS-RES-002"));
  }

  @Test
  void lateGuardDoesNotHideEarlierUse() {
    var r =
        analyze(
            "#include <stdlib.h>\n"
                + "int f(void){char*p=malloc(32);p[0]=1;if(!p)return 1;free(p);return 0;}");
    assertTrue(rules(r).contains("CS-RES-001"));
  }

  @Test
  void reallocOwnershipDoesNotProduceSimplisticLeakWarning() {
    var r = analyze("#include <stdlib.h>\nint f(void){char*p; p=realloc(p,32);return 0;}");
    assertEquals(
        1, r.path("modules").path("resources").path("data").path("reallocationCalls").asInt());
    assertFalse(rules(r).contains("CS-RES-002"));
  }

  @Test
  void duplicatesAreRealBodyFingerprints() throws Exception {
    var r = sample("duplicates");
    var matches = r.path("modules").path("duplication").path("data").path("matches");
    assertEquals(3, matches.size());
    assertEquals("EXACT_TOKENS", matches.get(0).path("matchType").asText());
    assertEquals("IDENTIFIER_RENAMING", matches.get(1).path("matchType").asText());
  }

  @Test
  void secretsAreAbsentAcrossAllProjectedArtifacts() {
    for (String tail : List.of("return 0;}", "return +;}")) {
      var r = analyze("int f(void){char *password=\"private-placeholder-ABC\";" + tail);
      assertFalse(r.toString().contains("private-placeholder-ABC"));
      assertTrue(r.toString().contains("REDACTED"));
    }
  }

  @Test
  void macroAndUnknownHeaderWithholdResults() {
    for (String prefix : List.of("#define VALUE 2", "#include \"../../private.h\"")) {
      var r = analyze(prefix + "\nint f(void){return 1;}");
      assertEquals("PARTIAL_ANALYSIS", r.path("status").asText());
      assertTrue(r.path("modules").path("ast").path("data").isNull());
      assertTrue(r.path("summary").path("riskScore").isNull());
    }
  }

  @Test
  void syntaxErrorHasNoFalseZeroRiskOrDownstream() throws Exception {
    var r = sample("syntax-error");
    assertEquals("PARSE_ERROR", r.path("status").asText());
    assertEquals("SKIPPED", r.path("modules").path("security").path("status").asText());
    assertTrue(r.path("summary").path("functionCount").isNull());
  }

  @Test
  void repeatAnalysisIsDeterministic() throws Exception {
    String code = Files.readString(Path.of("../samples/hero.c"));
    assertEquals(service.analyze(code, "hero.c"), service.analyze(code, "hero.c"));
  }

  @ParameterizedTest
  @ValueSource(
      strings = {
        "hero",
        "arithmetic",
        "scopes",
        "strings",
        "bounded",
        "secrets",
        "loops",
        "resources",
        "duplicates",
        "unsupported"
      })
  void fixturesParseAndNeverCrash(String name) throws Exception {
    assertNotEquals("PARSE_ERROR", sample(name).path("status").asText());
  }

  @Test
  void analyzeHasNoFileSideEffects() throws Exception {
    try (var files = Files.list(Path.of("."))) {
      Set<Path> before = new HashSet<>(files.toList());
      service.analyze(
          "#include <stdlib.h>\nint f(void){system(\"echo never-run\");return 0;}",
          "../../never-create.c");
      try (var after = Files.list(Path.of("."))) {
        assertEquals(before, new HashSet<>(after.toList()));
      }
    }
  }
}
