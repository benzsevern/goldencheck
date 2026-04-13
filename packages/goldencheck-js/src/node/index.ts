/**
 * GoldenCheck Node layer — file reading, Polars integration, YAML config.
 * Requires Node.js >= 20.
 */

// Re-export core for convenience
export * from "../core/index.js";

// Node-only: file reader
export { readFile, readCsv, type ReadOptions } from "./reader.js";
