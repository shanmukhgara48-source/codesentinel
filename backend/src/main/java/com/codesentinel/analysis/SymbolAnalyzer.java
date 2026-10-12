package com.codesentinel.analysis;

import com.codesentinel.model.*;
import java.util.*;

public class SymbolAnalyzer {
  public record Symbol(
      String id,
      String name,
      String category,
      String type,
      String scope,
      SourceRange range,
      int pointerDepth,
      List<String> arrayDimensions,
      List<String> parameterTypes,
      String origin) {}

  public record Reference(String nodeId, String name, String symbolId, SourceRange range) {}

  public record Result(
      List<Symbol> symbols, List<Reference> references, List<Diagnostic> diagnostics) {}

  private final List<Symbol> symbols = new ArrayList<>();
  private final List<Reference> references = new ArrayList<>();
  private final List<Diagnostic> diagnostics = new ArrayList<>();
  private final Deque<Map<String, Symbol>> scopes = new ArrayDeque<>();
  private final Deque<String> names = new ArrayDeque<>();
  private int serial = 0, scopeSerial = 0;
  private Node function;
  private final Set<String> definitions = new HashSet<>();

  public Result analyze(Node ast, Set<String> headers) {
    push("global");
    for (String header : headers)
      for (String name : LibraryCatalog.HEADERS.getOrDefault(header, List.of()))
        declareLibrary(name, "FUNCTION", "external");
    if (headers.contains("stddef.h")
        || headers.contains("stdlib.h")
        || headers.contains("stdio.h")
        || headers.contains("string.h")) {
      declareLibrary("NULL", "CONSTANT", "null-pointer constant");
      declareLibrary("size_t", "TYPE", "size_t");
    }
    // Register signatures once so recursion and prototype compatibility share one symbol.
    for (Node top : ast.children)
      for (Node n : top.kind.equals("Declarations") ? top.children : List.of(top))
        if (n.kind.equals("Function") || n.kind.equals("Prototype")) registerFunction(n);
    for (Node n : ast.children) visit(n);
    pop();
    return new Result(symbols, references, diagnostics);
  }

  private void push(String name) {
    scopes.push(new LinkedHashMap<>());
    names.push(name);
  }

  private void pop() {
    scopes.pop();
    names.pop();
  }

  private Symbol lookup(String name) {
    for (var scope : scopes) if (scope.containsKey(name)) return scope.get(name);
    return null;
  }

  private void declareLibrary(String name, String category, String type) {
    var s =
        new Symbol(
            "lib:" + name,
            name,
            category,
            type,
            "library",
            null,
            0,
            List.of(),
            List.of(),
            "LIBRARY");
    scopes.getLast().put(name, s);
    symbols.add(s);
  }

  @SuppressWarnings("unchecked")
  private Symbol make(Node n, String category, String scope) {
    return new Symbol(
        "s" + (serial++),
        n.text("name"),
        category,
        n.text("type"),
        scope,
        n.range,
        ((Number) n.attributes.getOrDefault("pointerDepth", 0)).intValue(),
        (List<String>) n.attributes.getOrDefault("arrayDimensions", List.of()),
        n.children.stream()
            .filter(c -> c.kind.equals("Parameter"))
            .map(
                c ->
                    c.text("type")
                        + "*"
                            .repeat(
                                ((Number) c.attributes.getOrDefault("pointerDepth", 0)).intValue()))
            .toList(),
        "SOURCE");
  }

  private void registerFunction(Node n) {
    if (n.kind.equals("Function") && !definitions.add(n.text("name")))
      diagnostic(
          "SEM-DUPLICATE-FUNCTION",
          n,
          "Multiple definitions of " + n.text("name"),
          "A function can have compatible prototypes but only one definition in this translation"
              + " unit.");
    String name = n.text("name");
    var global = scopes.peek();
    Symbol old = global.get(name), s = make(n, "FUNCTION", names.peek());
    if (old == null || old.origin().equals("LIBRARY")) {
      global.put(name, s);
      if (old != null) symbols.remove(old);
      symbols.add(s);
    } else if (!old.type().equals(s.type())
        || !old.parameterTypes().equals(s.parameterTypes())
        || old.pointerDepth() != s.pointerDepth())
      diagnostic(
          "SEM-FUNCTION",
          n,
          "Conflicting declaration for " + name,
          "Supported return and parameter signatures must agree.");
    else s = old;
    n.attr("symbolId", s.id());
  }

  private void declare(Node n, String category) {
    if (n.text("name").isEmpty()) return;
    Symbol s = make(n, category, names.peek());
    if (scopes.peek().containsKey(s.name())) {
      diagnostic(
          "SEM-DUPLICATE",
          n,
          "Duplicate declaration of " + s.name(),
          "An ordinary identifier is already declared in this scope.");
      n.attr("symbolId", scopes.peek().get(s.name()).id());
    } else {
      scopes.peek().put(s.name(), s);
      symbols.add(s);
      n.attr("symbolId", s.id());
    }
  }

  private void visit(Node n) {
    switch (n.kind) {
      case "Function" -> {
        Node previous = function;
        function = n;
        push(n.text("name") + "#" + (scopeSerial++));
        n.children.stream()
            .filter(c -> c.kind.equals("Parameter"))
            .forEach(c -> declare(c, "PARAMETER"));
        // Function parameters and the outermost body share a C scope.
        n.children.stream()
            .filter(c -> c.kind.equals("Block"))
            .forEach(b -> b.children.forEach(this::visit));
        pop();
        function = previous;
      }
      case "Prototype" -> {
        if (!names.peek().equals("global")) registerFunction(n);
      }
      case "Parameter" -> {}
      case "Block", "For" -> {
        push(names.peek() + "/block" + (scopeSerial++));
        n.children.forEach(this::visit);
        pop();
      }
      case "Declaration" -> {
        declare(n, "VARIABLE");
        n.children.forEach(this::visit);
      }
      case "Identifier" -> {
        Symbol s = lookup(n.text("name"));
        if (s == null
            || (s.origin().equals("SOURCE")
                && s.category().equals("FUNCTION")
                && s.range().startOffset() > n.range.startOffset()))
          diagnostic(
              "SEM-UNDECLARED",
              n,
              "Undeclared identifier " + n.text("name"),
              "Declare this identifier before use. Header expansion and full C type checking are"
                  + " not performed.");
        else {
          n.attr("symbolId", s.id())
              .attr("type", s.type())
              .attr("origin", s.origin())
              .attr("pointerDepth", s.pointerDepth())
              .attr("arrayDimensions", s.arrayDimensions());
          references.add(new Reference(n.id, s.name(), s.id(), n.range));
        }
      }
      case "Return" -> {
        boolean returnsVoid = function != null
            && function.text("type").replaceAll("\\b(static|inline|const|volatile)\\b", "").strip().equals("void")
            && ((Number) function.attributes.getOrDefault("pointerDepth", 0)).intValue() == 0;
        if (function != null
            && ((returnsVoid && !n.children.isEmpty())
                || (!returnsVoid && n.children.isEmpty())))
          diagnostic(
              "SEM-RETURN",
              n,
              "Return value does not match " + function.text("type"),
              "Only presence or absence of a return value is checked.");
        n.children.forEach(this::visit);
      }
      case "Unsupported" -> {}
      default -> n.children.forEach(this::visit);
    }
  }

  private void diagnostic(String code, Node n, String message, String explanation) {
    diagnostics.add(new Diagnostic(code, "ERROR", message, n.range, explanation));
  }
}
