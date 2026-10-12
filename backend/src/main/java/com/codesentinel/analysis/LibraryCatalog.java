package com.codesentinel.analysis;

import java.util.*;

public final class LibraryCatalog {
  public static final Map<String, List<String>> HEADERS =
      Map.of(
          "stdio.h",
              List.of(
                  "printf",
                  "fprintf",
                  "sprintf",
                  "snprintf",
                  "scanf",
                  "sscanf",
                  "fscanf",
                  "gets",
                  "fgets",
                  "puts",
                  "putchar",
                  "getchar"),
          "stdlib.h", List.of("malloc", "calloc", "realloc", "free", "system", "atoi", "exit"),
          "string.h",
              List.of(
                  "strcpy", "strcat", "strncpy", "strncat", "strlen", "memcpy", "memmove", "memset",
                  "strcmp"),
          "stddef.h", List.of());

  public static boolean isKnown(String name) {
    return HEADERS.values().stream().anyMatch(v -> v.contains(name));
  }

  private LibraryCatalog() {}
}
