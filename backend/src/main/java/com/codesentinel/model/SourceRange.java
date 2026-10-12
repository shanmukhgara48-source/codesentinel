package com.codesentinel.model;

public record SourceRange(
    int startOffset, int endOffset, int line, int column, int endLine, int endColumn) {}
