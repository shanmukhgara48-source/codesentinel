package com.codesentinel.analysis;

import com.codesentinel.model.Finding;
import java.util.*;

public class RiskScorer {
  public record Contribution(
      String findingId,
      String ruleId,
      String functionName,
      String severity,
      String confidence,
      double points) {}

  public record Result(
      int score,
      String label,
      String formula,
      List<Contribution> contributions,
      Map<String, Long> severityDistribution,
      Map<String, Integer> functionScores) {}

  public List<Finding> deduplicate(List<Finding> input) {
    Map<String, Finding> unique = new LinkedHashMap<>();
    for (var f : input) unique.putIfAbsent(f.id(), f);
    return new ArrayList<>(unique.values());
  }

  public Result score(List<Finding> findings) {
    Map<String, Integer> weights =
        Map.of("CRITICAL", 25, "HIGH", 15, "MEDIUM", 8, "LOW", 3, "INFORMATIONAL", 0);
    Map<String, Double> confidence = Map.of("HIGH", 1.0, "MEDIUM", 0.75, "LOW", 0.5);
    List<Contribution> contributions = new ArrayList<>();
    Map<String, Long> distribution = new LinkedHashMap<>();
    weights.keySet().stream().sorted().forEach(k -> distribution.put(k, 0L));
    Map<String, Double> functions = new TreeMap<>();
    double sum = 0;
    for (var f : findings) {
      double points = weights.get(f.severity()) * confidence.get(f.confidence());
      sum += points;
      functions.merge(f.functionName(), points, Double::sum);
      distribution.merge(f.severity(), 1L, Long::sum);
      contributions.add(
          new Contribution(
              f.id(), f.ruleId(), f.functionName(), f.severity(), f.confidence(), points));
    }
    Map<String, Integer> scores = new TreeMap<>();
    functions.forEach((f, p) -> scores.put(f, Math.min(100, (int) Math.round(p))));
    return new Result(
        Math.min(100, (int) Math.round(sum)),
        "Heuristic review-priority score",
        "min(100, round(sum(severity weight × confidence multiplier)))",
        contributions,
        distribution,
        scores);
  }
}
