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
export { applyFixes, type FixEntry, type FixReport } from "./engine/fixer.js";
export { diffData, formatDiffReport, type DiffReport, type SchemaChange, type FindingChange, type StatChange } from "./engine/differ.js";

// Config
export { validateConfig } from "./config/schema.js";

// Reporters
export { reportJson } from "./reporters/json.js";
export { ciCheck } from "./reporters/ci.js";

// LLM
export { callLlm, checkLlmAvailable } from "./llm/providers.js";
export { parseLlmResponse } from "./llm/parser.js";
export { mergeLlmFindings } from "./llm/merger.js";
export { buildSampleBlocks } from "./llm/sample-block.js";
export { estimateCost, checkBudget, CostReport } from "./llm/budget.js";
export type { LLMResponse, LLMColumnAssessment, LLMRelation } from "./llm/prompts.js";

// Baseline
export { createBaseline } from "./baseline/index.js";
export {
  type BaselineProfile,
  type StatProfile,
  type ConfidencePrior,
  serializeBaseline,
  deserializeBaseline,
} from "./baseline/models.js";

// Drift
export { runDriftChecks } from "./drift/detector.js";

// Validator
export { validateData } from "./engine/validator.js";

// Profilers
export { COLUMN_PROFILERS, type Profiler, type RelationProfiler, generalize } from "./profilers/index.js";

// Relations
export { RELATION_PROFILERS } from "./relations/index.js";

// Semantic
export { classifyColumns, loadTypeDefs, matchByName } from "./semantic/classifier.js";
export { applySuppression } from "./semantic/suppression.js";
export { BASE_TYPES } from "./semantic/types.js";
export { listAvailableDomains, getDomainTypes, DOMAIN_REGISTRY } from "./semantic/domains/index.js";
