#!/usr/bin/env node
import process from "node:process";

import { ui } from "./ui.js";
import { cli } from "./cli.js";
import { loadConfig, runTestAndFix } from "./commands.js";

async function main() {
  process.on("SIGINT", () => {
    ui.destroy();
    process.exit(0);
  });

  cli.action(async (testCommandAndArgs, options) => {
    try {
      const config = loadConfig(testCommandAndArgs, options);
      await runTestAndFix(config);
    } catch (error) {
      console.error(
        "Error:",
        error instanceof Error ? error.message : String(error)
      );
      process.exit(1);
    }
  });

  cli.parse();
}

main().catch(console.error);
