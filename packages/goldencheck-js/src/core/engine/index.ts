export { scanData, type ScanOptions, type ScanResultWithSample } from "./scanner.js";
export { maybeSample } from "./sampler.js";
export { applyCorroborationBoost, applyConfidenceDowngrade } from "./confidence.js";
export { applyFixes, type FixEntry, type FixReport } from "./fixer.js";
export { diffData, formatDiffReport, type DiffReport, type SchemaChange, type FindingChange, type StatChange } from "./differ.js";
