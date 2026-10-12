package com.codesentinel.model;

public record Diagnostic(
    String code, String severity, String message, SourceRange range, String explanation) {}
