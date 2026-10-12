package com.codesentinel;

import static org.junit.jupiter.api.Assertions.*;

import java.nio.file.*;
import java.util.regex.Pattern;
import org.junit.jupiter.api.Test;

class BoundaryTest {
  @Test
  void productionParserAndPassesHaveNoNativeOrSourceFileIntegration() throws Exception {
    Pattern forbidden =
        Pattern.compile(
            "ProcessBuilder|Runtime\\.getRuntime|new\\s+(FileReader|FileWriter|FileInputStream|FileOutputStream)|Files\\.(read|write|create|new)|\\.exec\\(");
    for (String folder : new String[] {"parser", "analysis"})
      try (var files = Files.walk(Path.of("src/main/java/com/codesentinel/" + folder))) {
        for (Path file : files.filter(p -> p.toString().endsWith(".java")).toList())
          assertFalse(forbidden.matcher(Files.readString(file)).find(), file.toString());
      }
  }
}
