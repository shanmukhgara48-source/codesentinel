package com.codesentinel;

import static org.junit.jupiter.api.Assertions.*;

import com.codesentinel.parser.ParserAdapter;
import org.junit.jupiter.api.Test;

class FoundationTest {
  @Test
  void realCParserProducesStructuredData() {
    var result = new ParserAdapter().parse("int calculate(void) { int a = 2 * 8 + 1; return a; }");
    assertTrue(result.valid(), result.diagnostics().toString());
    assertEquals("calculate", result.ast().children.getFirst().text("name"));
    assertTrue(result.tokens().stream().anyMatch(t -> t.text().equals("return")));
  }

  @Test
  void malformedCProducesLocatedDiagnostic() {
    var result = new ParserAdapter().parse("int main(void) { return +; }");
    assertFalse(result.valid());
    assertTrue(result.diagnostics().getFirst().range().column() > 0);
  }

  @Test
  void emptyInputAndCommentTokensHaveTruthfulRepresentation() {
    assertTrue(new ParserAdapter().parse("").valid());
    var r = new ParserAdapter().parse("/* note */\nint f(void){return 0;}");
    assertTrue(
        r.tokens().stream().anyMatch(t -> t.category().equals("COMMENT") && t.channel() != 0));
    assertEquals(2, r.ast().children.getFirst().range.line());
  }

  @Test
  void tokenAndNestingLimitsAreEnforcedBeforeParsing() {
    assertThrows(
        IllegalArgumentException.class,
        () -> new ParserAdapter().parse("(".repeat(129) + "0" + ")".repeat(129)));
    assertThrows(
        IllegalArgumentException.class, () -> new ParserAdapter().parse("x;".repeat(5001)));
  }

  @Test
  void lexerErrorOffsetMatchesItsLineAndColumn() {
    var r = new ParserAdapter().parse("int f(void){\nreturn @;}");
    var d = r.diagnostics().getFirst();
    assertEquals(2, d.range().line());
    assertEquals(20, d.range().startOffset());
  }
}
