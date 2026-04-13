#!/usr/bin/env node
/**
 * GoldenCheck CLI — TypeScript port.
 * Placeholder entry point — full commands added in Phase 11.
 */

import { Command } from "commander";

const program = new Command();

program
  .name("goldencheck-js")
  .description("Data validation that discovers rules from your data")
  .version("0.1.0");

program
  .command("scan <file>")
  .description("Scan a file for data quality issues")
  .option("--domain <domain>", "Domain pack (healthcare, finance, ecommerce)")
  .option("--json", "Output as JSON")
  .option("--llm-boost", "Enhance with LLM analysis")
  .option("--baseline <path>", "Baseline file for drift detection")
  .option("--sample-size <n>", "Sample size", "100000")
  .action((_file: string, _opts: Record<string, unknown>) => {
    console.log("scan command — not yet implemented");
    process.exit(1);
  });

program.parse();
