package com.codesentinel.parser;

import com.codesentinel.model.*;
import com.codesentinel.parser.generated.*;
import java.util.*;
import org.antlr.v4.runtime.*;

public class ParserAdapter {
  public record LexToken(
      String id, String text, String type, String category, int channel, SourceRange range) {}

  public record Parsed(
      Node ast, List<LexToken> tokens, List<Diagnostic> diagnostics, boolean valid) {}

  @SuppressWarnings("deprecation")
  public Parsed parse(String source) {
    try {
      return parseSource(source);
    } catch (StackOverflowError e) {
      // ANTLR also recurses on operator chains without bracket nesting.
      throw new IllegalArgumentException("Analysis limit exceeded: expression nesting is too deep.");
    }
  }

  @SuppressWarnings("deprecation")
  private Parsed parseSource(String source) {
    List<Diagnostic> diagnostics = new ArrayList<>();
    BaseErrorListener errors =
        new BaseErrorListener() {
          @Override
          public void syntaxError(
              Recognizer<?, ?> r,
              Object token,
              int line,
              int col,
              String msg,
              RecognitionException e) {
            int off =
                token instanceof Token t
                    ? Math.max(0, t.getStartIndex())
                    : offset(source, line, col);
            diagnostics.add(
                new Diagnostic(
                    "C-SYNTAX",
                    "ERROR",
                    r instanceof Lexer ? "Unrecognized token or unterminated literal." : msg,
                    new SourceRange(off, off, line, col + 1, line, col + 1),
                    "The C grammar could not recognize this source."));
          }
        };
    // UTF-16 stream keeps offsets consistent with JavaScript editor selections.
    CLexer lexer = new CLexer(new ANTLRInputStream(source));
    lexer.removeErrorListeners();
    lexer.addErrorListener(errors);
    CommonTokenStream stream = new CommonTokenStream(lexer);
    stream.fill();
    List<LexToken> tokens = new ArrayList<>();
    int depth = 0, significant = 0;
    for (Token t : stream.getTokens()) {
      if (t.getType() == Token.EOF) continue;
      String type = lexer.getVocabulary().getSymbolicName(t.getType());
      if (type == null) type = lexer.getVocabulary().getDisplayName(t.getType());
      if (Set.of("Whitespace", "Newline").contains(type)) continue;
      String category = category(type, t.getText());
      tokens.add(
          new LexToken(
              "tok" + t.getTokenIndex(), t.getText(), type, category, t.getChannel(), range(t, t)));
      if (t.getChannel() == 0) significant++;
      if (t.getChannel() == 0 && Set.of("(", "[", "{").contains(t.getText())) depth++;
      if (depth > 128 || significant > 10000)
        throw new IllegalArgumentException(
            "Analysis limit exceeded: 10,000 tokens or 128 nesting levels.");
      if (t.getChannel() == 0 && Set.of(")", "]", "}").contains(t.getText())) depth--;
    }
    CParser parser = new CParser(stream);
    parser.removeErrorListeners();
    parser.addErrorListener(errors);
    var tree = parser.compilationUnit();
    checkTreeDepth(tree);
    Node root = diagnostics.isEmpty() ? new AstBuilder().build(tree) : null;
    if (root != null) checkAstDepth(root);
    return new Parsed(root, tokens, diagnostics, diagnostics.isEmpty());
  }

  private void checkTreeDepth(org.antlr.v4.runtime.tree.ParseTree root) {
    record Item(org.antlr.v4.runtime.tree.ParseTree tree, int depth) {}
    Deque<Item> pending = new ArrayDeque<>();
    pending.push(new Item(root, 0));
    while (!pending.isEmpty()) {
      var item = pending.pop();
      if (item.depth() > 512)
        throw new IllegalArgumentException("Analysis limit exceeded: 512 grammar nesting levels.");
      for (int i = 0; i < item.tree().getChildCount(); i++)
        pending.push(new Item(item.tree().getChild(i), item.depth() + 1));
    }
  }

  private void checkAstDepth(Node root) {
    record Item(Node node, int depth) {}
    Deque<Item> pending = new ArrayDeque<>();
    pending.push(new Item(root, 0));
    while (!pending.isEmpty()) {
      var item = pending.pop();
      if (item.depth() > 128)
        throw new IllegalArgumentException("Analysis limit exceeded: 128 AST nesting levels.");
      for (Node child : item.node().children) pending.push(new Item(child, item.depth() + 1));
    }
  }

  public static SourceRange range(Token start, Token end) {
    if (start == null) return new SourceRange(0, 0, 1, 1, 1, 1);
    if (end == null) end = start;
    if (end.getType() == Token.EOF)
      return new SourceRange(
          Math.max(0, start.getStartIndex()),
          Math.max(0, end.getStartIndex()),
          start.getLine(),
          start.getCharPositionInLine() + 1,
          end.getLine(),
          end.getCharPositionInLine() + 1);
    String txt = end.getText() == null ? "" : end.getText();
    int line = end.getLine(), col = end.getCharPositionInLine() + 1;
    for (int i = 0; i < txt.length(); i++) {
      if (txt.charAt(i) == '\n') {
        line++;
        col = 1;
      } else col++;
    }
    return new SourceRange(
        Math.max(0, start.getStartIndex()),
        Math.max(0, end.getStopIndex() + 1),
        start.getLine(),
        start.getCharPositionInLine() + 1,
        line,
        col);
  }

  private static int offset(String source, int line, int column) {
    int start = 0;
    for (int n = 1; n < line; n++) {
      int next = source.indexOf('\n', start);
      if (next < 0) return source.length();
      start = next + 1;
    }
    return Math.min(source.length(), start + column);
  }

  private static String category(String type, String text) {
    if (type.contains("Comment")) return "COMMENT";
    if (type.contains("Directive") || type.contains("Macro")) return "DIRECTIVE";
    if (type.equals("Identifier")) return "IDENTIFIER";
    if (type.equals("StringLiteral")) return "STRING";
    if (type.contains("Constant") || type.equals("DigitSequence")) return "LITERAL";
    if (text.matches("[a-zA-Z_]+")) return "KEYWORD";
    return Set.of("(", ")", "{", "}", "[", "]", ";", ",").contains(text)
        ? "PUNCTUATION"
        : "OPERATOR";
  }
}
