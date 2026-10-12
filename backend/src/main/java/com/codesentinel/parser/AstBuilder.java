package com.codesentinel.parser;

import com.codesentinel.model.*;
import com.codesentinel.parser.generated.CParser;
import java.util.*;
import org.antlr.v4.runtime.*;
import org.antlr.v4.runtime.tree.*;

/** Explicit parse-tree conversion; all later passes use Node, not ANTLR contexts. */
public class AstBuilder {
  private int counter = 0;

  private Node node(String kind, ParserRuleContext c) {
    return new Node("n" + (counter++), kind, ParserAdapter.range(c.getStart(), c.getStop()));
  }

  private String rule(ParseTree p) {
    return p instanceof ParserRuleContext c ? CParser.ruleNames[c.getRuleIndex()] : "";
  }

  private List<ParserRuleContext> rules(ParseTree p, String name) {
    List<ParserRuleContext> out = new ArrayList<>();
    for (int i = 0; i < p.getChildCount(); i++)
      if (rule(p.getChild(i)).equals(name)) out.add((ParserRuleContext) p.getChild(i));
    return out;
  }

  private ParserRuleContext first(ParseTree p, String name) {
    return rules(p, name).stream().findFirst().orElse(null);
  }

  private Node visitFirst(ParseTree p, String name) {
    var c = first(p, name);
    return c == null ? null : build(c);
  }

  public Node build(ParseTree p) {
    if (p == null) return null;
    if (!(p instanceof ParserRuleContext c)) return null;
    String r = rule(c);
    return switch (r) {
      case "compilationUnit", "translationUnit", "blockItemList" ->
          collection(r.equals("blockItemList") ? "Statements" : "TranslationUnit", c);
      case "externalDeclaration", "blockItem", "statement", "functionBody" -> {
        if (c.getChildCount() > 0 && c.getChild(0).getText().equals("__extension__"))
          yield unsupported(c, "GNU declaration extensions are unsupported.");
        Node child = null;
        for (int j = 0; j < c.getChildCount(); j++)
          if (c.getChild(j) instanceof ParserRuleContext) {
            child = build(c.getChild(j));
            break;
          }
        yield child;
      }
      case "functionDefinition" -> function((CParser.FunctionDefinitionContext) c);
      case "declaration", "forDeclaration" -> declarations(c);
      case "compoundStatement" -> collection("Block", c);
      case "expressionStatement" -> node("ExpressionStatement", c).add(visitFirst(c, "expression"));
      case "selectionStatement" -> selection((CParser.SelectionStatementContext) c);
      case "iterationStatement" -> loop((CParser.IterationStatementContext) c);
      case "jumpStatement" -> jump(c);
      case "expression", "forExpression" -> expressions(c);
      case "assignmentExpression" -> assignment(c);
      case "conditionalExpression" ->
          c.getChildCount() == 1
              ? build(c.getChild(0))
              : unsupported(c, "Conditional ?: expressions are not lowered.");
      case "logicalOrExpression",
          "logicalAndExpression",
          "inclusiveOrExpression",
          "exclusiveOrExpression",
          "andExpression",
          "equalityExpression",
          "relationalExpression",
          "shiftExpression",
          "additiveExpression",
          "multiplicativeExpression" ->
          binary(c);
      case "castExpression" ->
          first(c, "typeName") == null
              ? build(c.getChild(0))
              : node("Cast", c)
                  .attr("type", first(c, "typeName").getText())
                  .add(visitFirst(c, "castExpression"));
      case "unaryExpression" -> unary(c);
      case "postfixExpression" -> postfix(c);
      case "primaryExpression" -> primary(c);
      case "constant", "predefinedConstant" -> literal(c, c.getText());
      case "initializer" ->
          c.getChildCount() == 1
              ? build(c.getChild(0))
              : unsupported(c, "Aggregate initializers are not lowered.");
      default -> unsupported(c, "Unsupported grammar construct: " + r);
    };
  }

  private Node collection(String kind, ParserRuleContext c) {
    Node n = node(kind, c);
    for (int i = 0; i < c.getChildCount(); i++)
      if (c.getChild(i) instanceof ParserRuleContext) {
        Node child = build(c.getChild(i));
        if (child != null && Set.of("TranslationUnit", "Statements").contains(child.kind))
          n.children.addAll(child.children);
        else n.add(child);
      }
    return n;
  }

  private Node function(CParser.FunctionDefinitionContext c) {
    Node n = declarator(c.declarator(), type(c.declarationSpecifiers()), "Function");
    n.range = ParserAdapter.range(c.getStart(), c.getStop());
    if (c.declarationList() != null)
      return unsupported(c, "Old-style function definitions are unsupported.");
    return n.add(build(c.functionBody()));
  }

  private String type(ParserRuleContext c) {
    if (c == null) return "int";
    List<String> values = new ArrayList<>();
    for (int i = 0; i < c.getChildCount(); i++) values.add(c.getChild(i).getText());
    return String.join(" ", values);
  }

  private Node declarations(ParserRuleContext c) {
    var specs = first(c, "declarationSpecifiers");
    var list = first(c, "initDeclaratorList");
    if (specs == null
        || specs.getText().matches(".*(typedef|struct|union|enum|extern|_Atomic|constexpr).*"))
      return unsupported(c, "This declaration form has no complete semantic model.");
    Node group = node("Declarations", c);
    if (list != null)
      for (var init : rules(list, "initDeclarator")) {
        var d = (CParser.DeclaratorContext) first(init, "declarator");
        Node n = declarator(d, type(specs), null);
        n.range = ParserAdapter.range(init.getStart(), init.getStop());
        n.add(visitFirst(init, "initializer"));
        group.add(n);
      }
    return group;
  }

  private Node declarator(CParser.DeclaratorContext d, String type, String forcedKind) {
    if (d == null
        || d.directDeclarator().Identifier() == null
        || d.directDeclarator().declarator() != null
        || d.getText().contains("..."))
      return unsupported(d, "Complex declarators are unsupported.");
    var direct = d.directDeclarator();
    boolean function = direct.children.stream()
        .anyMatch(child -> child instanceof TerminalNode && child.getText().equals("("));
    int pointers =
        d.pointer().stream()
            .mapToInt(x -> (int) x.getText().chars().filter(ch -> ch == '*').count())
            .sum();
    List<String> arrays =
        rules(direct, "assignmentExpression").stream().map(ParseTree::getText).toList();
    Node n =
        node(forcedKind != null ? forcedKind : function ? "Prototype" : "Declaration", d)
            .attr("name", direct.Identifier().getText())
            .attr("type", type)
            .attr("pointerDepth", pointers)
            .attr("arrayDimensions", arrays);
    if (d.pointer().stream().anyMatch(ptr -> !ptr.getText().matches("\\*+")))
      n.attr("unsupported", "Qualified pointer declarators are outside the current type model.");
    if (direct.getText().contains("[") && arrays.size() != 1) {
      n.attr("unsupported", "Only one fixed-size array dimension is modeled.");
    }
    if (arrays.size() == 1 && !arrays.getFirst().matches("[1-9][0-9]*"))
      n.attr(
          "unsupported",
          "Only positive decimal fixed array bounds are modeled; variable or computed bounds are"
              + " not assessed.");
    for (var paramType : rules(direct, "parameterTypeList")) {
      var params = first(paramType, "parameterList");
      if (params != null)
        for (var p : rules(params, "parameterDeclaration")) {
          String pt = type(first(p, "declarationSpecifiers"));
          var pd = first(p, "declarator");
          if (pd != null) {
            Node pn = declarator((CParser.DeclaratorContext) pd, pt, "Parameter");
            pn.range = ParserAdapter.range(p.getStart(), p.getStop());
            n.add(pn);
          } else if (!pt.equals("void")) {
            var abstractDecl = first(p, "abstractDeclarator");
            if (abstractDecl != null && !abstractDecl.getText().matches("\\*+"))
              n.add(unsupported(p, "Complex unnamed parameters are unsupported."));
            else n.add(
                node("Parameter", p)
                    .attr("name", "")
                    .attr("type", pt)
                    .attr("pointerDepth", abstractDecl == null ? 0 : abstractDecl.getText().length())
                    .attr("arrayDimensions", List.of()));
          }
        }
    }
    return n;
  }

  private Node expressions(ParserRuleContext c) {
    List<ParserRuleContext> exprs = rules(c, "assignmentExpression");
    if (exprs.size() == 1) return build(exprs.getFirst());
    Node n = node("Sequence", c);
    exprs.forEach(e -> n.add(build(e)));
    return n;
  }

  private Node assignment(ParserRuleContext c) {
    if (c.getChildCount() == 1) {
      if (c.getChild(0) instanceof TerminalNode) return literal(c, c.getText());
      return build(c.getChild(0));
    }
    return node("Assignment", c)
        .attr("operator", c.getChild(1).getText())
        .add(build(c.getChild(0)))
        .add(build(c.getChild(2)));
  }

  private Node binary(ParserRuleContext c) {
    Node result = build(c.getChild(0));
    for (int i = 1; i + 1 < c.getChildCount(); i += 2) {
      Node right = build(c.getChild(i + 1));
      Node binary = node("Binary", c).attr("operator", c.getChild(i).getText()).add(result).add(right);
      binary.range = new SourceRange(result.range.startOffset(), right.range.endOffset(),
          result.range.line(), result.range.column(), right.range.endLine(), right.range.endColumn());
      result = binary;
    }
    return result;
  }

  private Node primary(ParserRuleContext c) {
    if (first(c, "expression") != null) return visitFirst(c, "expression");
    if (first(c, "constant") != null) return visitFirst(c, "constant");
    if (c.getChild(0) instanceof TerminalNode t) {
      if (t.getSymbol().getType() == com.codesentinel.parser.generated.CLexer.Identifier)
        return node("Identifier", c).attr("name", t.getText());
      if (t.getSymbol().getType() == com.codesentinel.parser.generated.CLexer.StringLiteral)
        return literal(c, c.getText());
    }
    return unsupported(c, "Unsupported primary expression.");
  }

  private Node literal(ParserRuleContext c, String text) {
    String kind =
        text.contains("\"")
            ? "string"
            : text.startsWith("'") ? "char" : text.matches("0|[1-9][0-9]*") ? "int" : "other";
    return node("Literal", c).attr("value", text).attr("literalType", kind);
  }

  private Node unary(ParserRuleContext c) {
    if (first(c, "postfixExpression") != null) return visitFirst(c, "postfixExpression");
    String op = c.getChild(0).getText();
    if (op.equals("sizeof"))
      return node("Sizeof", c)
          .attr("type", first(c, "typeName") == null ? "" : first(c, "typeName").getText())
          .add(visitFirst(c, "unaryExpression"));
    if (op.equals("++") || op.equals("--"))
      return node("Update", c)
          .attr("operator", op)
          .attr("postfix", false)
          .add(visitFirst(c, "unaryExpression"));
    if (first(c, "castExpression") != null)
      return node("Unary", c).attr("operator", op).add(visitFirst(c, "castExpression"));
    return unsupported(c, "Unsupported unary expression.");
  }

  private Node postfix(ParserRuleContext c) {
    if (!rule(c.getChild(0)).equals("primaryExpression"))
      return unsupported(c, "Compound literal expressions are unsupported.");
    Node result = build(c.getChild(0));
    for (int i = 1; i < c.getChildCount(); ) {
      String text = c.getChild(i).getText();
      if (text.equals("(")) {
        Node call = node("Call", c).add(result);
        i++;
        if (i < c.getChildCount() && rule(c.getChild(i)).equals("argumentExpressionList")) {
          for (var e : rules(c.getChild(i), "assignmentExpression")) call.add(build(e));
          i++;
        }
        result = call;
        i++;
      } else if (text.equals("[")) {
        result = node("Index", c).add(result).add(build(c.getChild(i + 1)));
        i += 3;
      } else if (text.equals("++") || text.equals("--")) {
        result = node("Update", c).attr("operator", text).attr("postfix", true).add(result);
        i++;
      } else
        return node("Unsupported", c)
            .attr("reason", "Member access is outside the first-release model.")
            .add(result);
    }
    return result;
  }

  private Node selection(CParser.SelectionStatementContext c) {
    if (!c.getChild(0).getText().equals("if"))
      return unsupported(c, "switch control flow is unsupported.");
    Node n = node("If", c).add(build(c.expression()));
    c.statement().forEach(s -> n.add(build(s)));
    return n;
  }

  private Node loop(CParser.IterationStatementContext c) {
    if (c.For() == null)
      return node(c.Do() == null ? "While" : "DoWhile", c)
          .add(build(c.expression()))
          .add(build(c.statement()));
    Node n = node("For", c),
        init = node("Init", c),
        condition = node("Condition", c),
        step = node("Step", c);
    int section = 0;
    var fc = c.forCondition();
    for (int i = 0; i < fc.getChildCount(); i++) {
      var child = fc.getChild(i);
      if (child.getText().equals(";")) section++;
      else if (child instanceof ParserRuleContext)
        (section == 0 ? init : section == 1 ? condition : step).add(build(child));
    }
    return n.add(init).add(condition).add(step).add(build(c.statement()));
  }

  private Node jump(ParserRuleContext c) {
    return switch (c.getChild(0).getText()) {
      case "return" -> node("Return", c).add(visitFirst(c, "expression"));
      case "break" -> node("Break", c);
      case "continue" -> node("Continue", c);
      default -> unsupported(c, "goto is unsupported.");
    };
  }

  private Node unsupported(ParserRuleContext c, String reason) {
    if (c == null)
      return new Node("n" + (counter++), "Unsupported", new SourceRange(0, 0, 1, 1, 1, 1))
          .attr("reason", reason);
    Node n = node("Unsupported", c).attr("reason", reason);
    for (int i = 0; i < c.getChildCount(); i++)
      if (c.getChild(i) instanceof ParserRuleContext cc) n.add(build(cc));
    return n;
  }
}
