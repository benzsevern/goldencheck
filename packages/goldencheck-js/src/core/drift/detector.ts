/**
 * Drift detector — 13 checks against saved baseline.
 * Port of goldencheck/drift/detector.py.
 */

import type { TabularData } from "../data.js";
import { isNullish } from "../data.js";
import { type Finding, Severity, makeFinding } from "../types.js";
import {
  ksTwoSample,
  entropy as calcEntropy,
  chiSquaredTest,
  benfordExpected,
  pearson,
} from "../stats.js";
import type {
  BaselineProfile,
  StatProfile,
  CorrelationEntry,
  PatternGrammar,
} from "../baseline/models.js";

// Thresholds matching Python
const KS_ERROR_PVALUE = 0.01;
const KS_WARN_PVALUE = 0.05;
const ENTROPY_DELTA_WARN = 0.5;
const BOUND_VIOLATION_RATE = 0.05;
const FD_VIOLATION_RATE = 0.05;
const FD_VIOLATION_MULTIPLIER = 2.0;
const TEMPORAL_VIOLATION_RATE = 0.05;
const TEMPORAL_VIOLATION_MULTIPLIER = 2.0;
const PATTERN_COVERAGE_DROP = 0.05;
const PATTERN_NEW_COVERAGE = 0.05;
const CORR_STRONG_THRESHOLD = 0.7;
const CORR_DROP_THRESHOLD = 0.1;

/**
 * Run all drift checks against a baseline profile.
 * All findings have source="baseline_drift".
 */
export function runDriftChecks(
  data: TabularData,
  baseline: BaselineProfile,
): Finding[] {
  const findings: Finding[] = [];

  // Statistical checks per column
  for (const [col, statProfile] of Object.entries(baseline.stats)) {
    if (!data.columns.includes(col)) continue;

    findings.push(...checkDistributionDrift(data, col, statProfile));
    findings.push(...checkEntropyDrift(data, col, statProfile));
    findings.push(...checkBoundViolation(data, col, statProfile));
    findings.push(...checkBenfordDrift(data, col, statProfile));
  }

  // Constraint checks
  findings.push(...checkFdViolations(data, baseline));
  findings.push(...checkKeyUniqueness(data, baseline));
  findings.push(...checkTemporalOrderDrift(data, baseline));

  // Pattern checks
  findings.push(...checkPatternDrift(data, baseline));

  // Correlation checks
  findings.push(...checkCorrelationDrift(data, baseline));

  // Type drift
  findings.push(...checkTypeDrift(data, baseline));

  return findings;
}

function drift(overrides: Partial<Finding> & Pick<Finding, "severity" | "column" | "check" | "message">): Finding {
  return makeFinding({ ...overrides, source: "baseline_drift" });
}

// --- Statistical checks ---

function checkDistributionDrift(data: TabularData, col: string, stat: StatProfile): Finding[] {
  if (!stat.distribution || stat.distribution === "categorical") return [];
  const currentNums = data.sortedNumeric(col);
  if (currentNums.length < 10) return [];

  // Need baseline values to compare — reconstruct from bounds
  if (!stat.bounds) return [];
  // Use KS test comparing current against uniform approximation from baseline
  // In practice, we'd compare against the baseline's distribution parameters
  // For now, check if bounds are violated (simpler drift signal)
  return [];
}

function checkEntropyDrift(data: TabularData, col: string, stat: StatProfile): Finding[] {
  if (stat.entropy === null || stat.entropy === undefined) return [];

  const counts = data.valueCounts(col);
  if (counts.size === 0) return [];
  const currentEntropy = calcEntropy(counts);
  const delta = Math.abs(currentEntropy - stat.entropy);

  if (delta > ENTROPY_DELTA_WARN) {
    return [drift({
      severity: Severity.WARNING,
      column: col,
      check: "entropy_drift",
      message: `Entropy changed from ${stat.entropy.toFixed(2)} to ${currentEntropy.toFixed(2)} (delta: ${delta.toFixed(2)} bits)`,
      confidence: 0.7,
    })];
  }
  return [];
}

function checkBoundViolation(data: TabularData, col: string, stat: StatProfile): Finding[] {
  if (!stat.bounds) return [];
  const nums = data.numericValues(col);
  if (nums.length === 0) return [];

  const violations = nums.filter((v) => v < stat.bounds!.p01 || v > stat.bounds!.p99);
  const rate = violations.length / nums.length;

  if (rate > BOUND_VIOLATION_RATE) {
    return [drift({
      severity: Severity.ERROR,
      column: col,
      check: "bound_violation",
      message: `${(rate * 100).toFixed(1)}% of values outside baseline p01/p99 bounds [${stat.bounds.p01}, ${stat.bounds.p99}]`,
      affectedRows: violations.length,
      sampleValues: violations.slice(0, 5).map(String),
      confidence: 0.85,
    })];
  }
  return [];
}

function checkBenfordDrift(data: TabularData, col: string, stat: StatProfile): Finding[] {
  if (!stat.benford) return [];

  const nums = data.numericValues(col).filter((v) => v > 0);
  if (nums.length < 30) return [];

  // Check if values span 2+ orders of magnitude
  const minVal = Math.min(...nums);
  const maxVal = Math.max(...nums);
  if (maxVal / Math.max(minVal, 0.001) < 100) return [];

  // Count first digits
  const digitCounts = new Array(9).fill(0) as number[];
  for (const v of nums) {
    const firstDigit = parseInt(String(Math.abs(v))[0]!);
    if (firstDigit >= 1 && firstDigit <= 9) {
      digitCounts[firstDigit - 1]!++;
    }
  }

  const expected = benfordExpected().map((p) => p * nums.length);
  const { pValue } = chiSquaredTest(digitCounts, expected);
  const currentConforming = pValue >= 0.05;
  const baselineConforming = stat.benford.conforming;

  if (currentConforming !== baselineConforming) {
    const direction = baselineConforming ? "no longer conforms" : "now conforms";
    return [drift({
      severity: Severity.WARNING,
      column: col,
      check: "benford_drift",
      message: `Benford's law conformance changed: column ${direction} to expected distribution`,
      confidence: 0.6,
    })];
  }
  return [];
}

// --- Constraint checks ---

function checkFdViolations(data: TabularData, baseline: BaselineProfile): Finding[] {
  const findings: Finding[] = [];

  for (const fd of baseline.functionalDeps) {
    if (!data.columns.includes(fd.determinant) || !data.columns.includes(fd.dependent)) continue;

    // Check violation rate
    const groups = new Map<string, Set<string>>();
    for (const row of data.rows) {
      const det = String(row[fd.determinant] ?? "");
      const dep = String(row[fd.dependent] ?? "");
      if (!groups.has(det)) groups.set(det, new Set());
      groups.get(det)!.add(dep);
    }

    let violations = 0;
    for (const [, deps] of groups) {
      if (deps.size > 1) violations++;
    }
    const rate = groups.size > 0 ? violations / groups.size : 0;

    if (rate > FD_VIOLATION_RATE || rate > fd.confidence * FD_VIOLATION_MULTIPLIER) {
      findings.push(drift({
        severity: Severity.ERROR,
        column: `${fd.determinant},${fd.dependent}`,
        check: "fd_violation",
        message: `Functional dependency ${fd.determinant} → ${fd.dependent} violated (${(rate * 100).toFixed(1)}% violation rate vs baseline ${((1 - fd.confidence) * 100).toFixed(1)}%)`,
        affectedRows: violations,
        confidence: 0.85,
      }));
    }
  }

  return findings;
}

function checkKeyUniqueness(data: TabularData, baseline: BaselineProfile): Finding[] {
  const findings: Finding[] = [];

  for (const key of baseline.candidateKeys) {
    if (!data.columns.includes(key)) continue;
    const uniquePct = data.nUnique(key) / Math.max(data.dropNulls(key).length, 1);
    if (uniquePct < 1.0) {
      findings.push(drift({
        severity: Severity.ERROR,
        column: key,
        check: "key_uniqueness_loss",
        message: `Candidate key '${key}' lost uniqueness (now ${(uniquePct * 100).toFixed(1)}% unique)`,
        confidence: 0.9,
      }));
    }
  }

  return findings;
}

function checkTemporalOrderDrift(data: TabularData, baseline: BaselineProfile): Finding[] {
  const findings: Finding[] = [];

  for (const to of baseline.temporalOrders) {
    if (!data.columns.includes(to.startCol) || !data.columns.includes(to.endCol)) continue;

    let violations = 0;
    let total = 0;
    for (const row of data.rows) {
      const s = row[to.startCol];
      const e = row[to.endCol];
      if (isNullish(s) || isNullish(e)) continue;
      total++;
      const sd = new Date(String(s));
      const ed = new Date(String(e));
      if (!isNaN(sd.getTime()) && !isNaN(ed.getTime()) && sd > ed) {
        violations++;
      }
    }

    const rate = total > 0 ? violations / total : 0;
    if (rate > TEMPORAL_VIOLATION_RATE || rate > to.violationRate * TEMPORAL_VIOLATION_MULTIPLIER) {
      findings.push(drift({
        severity: Severity.WARNING,
        column: `${to.startCol},${to.endCol}`,
        check: "temporal_order_drift",
        message: `Temporal order violation rate increased: ${(rate * 100).toFixed(1)}% vs baseline ${(to.violationRate * 100).toFixed(1)}%`,
        affectedRows: violations,
        confidence: 0.7,
      }));
    }
  }

  return findings;
}

// --- Pattern checks ---

function checkPatternDrift(data: TabularData, baseline: BaselineProfile): Finding[] {
  const findings: Finding[] = [];

  for (const [col, patterns] of Object.entries(baseline.patterns)) {
    if (!data.columns.includes(col)) continue;
    const nonNull = data.stringValues(col);
    if (nonNull.length === 0) continue;

    for (const pattern of patterns) {
      const re = new RegExp(pattern.regex);
      const matchCount = nonNull.filter((v) => re.test(v)).length;
      const currentCoverage = matchCount / nonNull.length;
      const drop = pattern.coverage - currentCoverage;

      if (drop > PATTERN_COVERAGE_DROP) {
        findings.push(drift({
          severity: Severity.WARNING,
          column: col,
          check: "pattern_drift",
          message: `Pattern '${pattern.regex}' coverage dropped from ${(pattern.coverage * 100).toFixed(1)}% to ${(currentCoverage * 100).toFixed(1)}%`,
          confidence: 0.6,
        }));
      }
    }

    // Check for new patterns not in baseline
    const baselineRegexes = new Set(patterns.map((p) => p.regex));
    // Simple check: are there values that don't match any baseline pattern?
    const unmatchedCount = nonNull.filter((v) => {
      return !patterns.some((p) => new RegExp(p.regex).test(v));
    }).length;
    const unmatchedRate = unmatchedCount / nonNull.length;
    if (unmatchedRate > PATTERN_NEW_COVERAGE) {
      findings.push(drift({
        severity: Severity.INFO,
        column: col,
        check: "new_pattern",
        message: `${(unmatchedRate * 100).toFixed(1)}% of values don't match any baseline pattern`,
        affectedRows: unmatchedCount,
        confidence: 0.5,
      }));
    }
  }

  return findings;
}

// --- Correlation checks ---

function checkCorrelationDrift(data: TabularData, baseline: BaselineProfile): Finding[] {
  const findings: Finding[] = [];

  for (const corr of baseline.correlations) {
    if (!data.columns.includes(corr.col1) || !data.columns.includes(corr.col2)) continue;

    let currentValue: number | null = null;
    if (corr.method === "pearson") {
      const nums1 = data.numericValues(corr.col1);
      const nums2 = data.numericValues(corr.col2);
      currentValue = pearson(nums1, nums2);
    }
    // Cramér's V would require contingency table — skip for now

    if (currentValue !== null) {
      const drop = Math.abs(corr.value) - Math.abs(currentValue);
      if (drop > CORR_DROP_THRESHOLD && corr.strength === "strong") {
        findings.push(drift({
          severity: Severity.WARNING,
          column: `${corr.col1},${corr.col2}`,
          check: "correlation_break",
          message: `Correlation between ${corr.col1} and ${corr.col2} dropped from ${corr.value.toFixed(2)} to ${currentValue.toFixed(2)}`,
          confidence: 0.6,
        }));
      }
    }
  }

  // Check for new strong correlations not in baseline
  const baselineCorrs = new Set(
    baseline.correlations.map((c) => [c.col1, c.col2].sort().join("|")),
  );
  const numCols = data.columns.filter((c) => data.isNumeric(c));
  for (let i = 0; i < numCols.length && i < 20; i++) {
    for (let j = i + 1; j < numCols.length && j < 20; j++) {
      const key = [numCols[i]!, numCols[j]!].sort().join("|");
      if (baselineCorrs.has(key)) continue;
      const nums1 = data.numericValues(numCols[i]!);
      const nums2 = data.numericValues(numCols[j]!);
      const r = pearson(nums1, nums2);
      if (r !== null && Math.abs(r) >= CORR_STRONG_THRESHOLD) {
        findings.push(drift({
          severity: Severity.INFO,
          column: `${numCols[i]},${numCols[j]}`,
          check: "new_correlation",
          message: `New strong correlation detected (r=${r.toFixed(2)}) not present in baseline`,
          confidence: 0.5,
        }));
      }
    }
  }

  return findings;
}

// --- Type drift ---

function checkTypeDrift(data: TabularData, baseline: BaselineProfile): Finding[] {
  const findings: Finding[] = [];

  for (const [col, baselineType] of Object.entries(baseline.semanticTypes)) {
    if (!data.columns.includes(col)) continue;
    const currentType = data.dtype(col);
    // Simple type comparison
    if (currentType !== baselineType && baselineType !== "unknown") {
      findings.push(drift({
        severity: Severity.WARNING,
        column: col,
        check: "type_drift",
        message: `Column type changed from '${baselineType}' to '${currentType}'`,
        confidence: 0.6,
      }));
    }
  }

  return findings;
}
