package com.codesentinel.model;

import java.util.*;

public record Finding(
    String id,
    String ruleId,
    String ruleName,
    String domain,
    String severity,
    String confidence,
    String filename,
    String functionName,
    String symbolId,
    SourceRange range,
    String excerpt,
    String explanation,
    String remediation,
    List<String> limitations) {}
