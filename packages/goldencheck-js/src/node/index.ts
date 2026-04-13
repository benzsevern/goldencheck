/**
 * GoldenCheck Node layer — file reading, Polars integration, YAML config.
 * Requires Node.js >= 20.
 */

// Re-export core for convenience
export * from "../core/index.js";

// Node-only: file reader
export { readFile, readCsv, type ReadOptions } from "./reader.js";

// Node-only: watcher
export { watchDirectory, type WatchOptions } from "./watcher.js";

// Node-only: MCP server
export { TOOL_DEFINITIONS, handleTool } from "./mcp/server.js";

// Node-only: TUI renderer
export { renderTui } from "./tui/app.js";

// Node-only: database scanner
export { scanDatabase } from "./db-scanner.js";

// Node-only: A2A server
export { runA2aServer } from "./a2a/server.js";
