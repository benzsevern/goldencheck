/**
 * GoldenCheck core — edge-safe public API.
 * No Node.js dependencies. Works in browsers, Edge Runtime, Workers.
 */

// Types & models
export {
  Severity,
  severityLabel,
  type Finding,
  type FindingInput,
  makeFinding,
  replaceFinding,
  type ColumnProfile,
  type ColumnProfileInput,
  makeColumnProfile,
  type DatasetProfile,
  type HealthScore,
  healthScore,
  type ScanResult,
  type Settings,
  type ColumnRule,
  type RelationRule,
  type IgnoreEntry,
  type GoldenCheckConfig,
  defaultSettings,
  defaultConfig,
  type TypeDef,
  type ColumnClassification,
} from "./types.js";

// Data abstraction
export { TabularData, isNullish, type ColumnValue, type Row, type Dtype } from "./data.js";

// Stats
export {
  mean,
  std,
  sampleStd,
  percentile,
  iqr,
  median,
  entropy,
  pearson,
  cramersV,
  ksTwoSample,
  chiSquaredTest,
  normalCdf,
  benfordExpected,
  createRng,
} from "./stats.js";

// Engine
export { scanData, type ScanOptions, type ScanResultWithSample } from "./engine/scanner.js";
export { maybeSample } from "./engine/sampler.js";
export { applyCorroborationBoost, applyConfidenceDowngrade } from "./engine/confidence.js";

// Profilers
export { COLUMN_PROFILERS, type Profiler, type RelationProfiler, generalize } from "./profilers/index.js";

// Relations
export { RELATION_PROFILERS } from "./relations/index.js";

// Semantic
export { classifyColumns, loadTypeDefs, matchByName } from "./semantic/classifier.js";
export { applySuppression } from "./semantic/suppression.js";
export { BASE_TYPES } from "./semantic/types.js";
export { listAvailableDomains, getDomainTypes, DOMAIN_REGISTRY } from "./semantic/domains/index.js";
