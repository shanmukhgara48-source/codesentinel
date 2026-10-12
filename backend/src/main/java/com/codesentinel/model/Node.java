package com.codesentinel.model;

import java.util.*;

/** Compact internal AST; parser types stay behind the adapter. */
public class Node {
  public String id;
  public String kind;
  public SourceRange range;
  public Map<String, Object> attributes = new LinkedHashMap<>();
  public List<Node> children = new ArrayList<>();

  public Node(String id, String kind, SourceRange range) {
    this.id = id;
    this.kind = kind;
    this.range = range;
  }

  public Node attr(String key, Object value) {
    if (value != null) attributes.put(key, value);
    return this;
  }

  public Node add(Node child) {
    if (child != null) children.add(child);
    return this;
  }

  public String text(String key) {
    return String.valueOf(attributes.getOrDefault(key, ""));
  }

  public List<Node> all() {
    List<Node> out = new ArrayList<>();
    walk(this, out);
    return out;
  }

  private static void walk(Node node, List<Node> out) {
    out.add(node);
    node.children.forEach(c -> walk(c, out));
  }
}
