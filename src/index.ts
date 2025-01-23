#!/usr/bin/env node
import process from "node:process";

import { ui } from "./ui.js";
import { cli } from "./cli.js";
import { loadConfig, loadRepoData, runTestAndFix } from "./commands.js";
import { Config } from "./types.js";

process.on("SIGINT", () => {
  ui.destroy();
  process.exit(0);
});

cli.action(async (testCommandAndArgs: string[], options: Config) => {
  const config = loadConfig(testCommandAndArgs, options);

  // Initialize UI before starting commands
  if (!config.hideReasoning) {
    ui.initialize();
  }

  const { testOutput, repoStructure, gitDiff } = await loadRepoData(config);

  await runTestAndFix({ config, testOutput, repoStructure, gitDiff });
});

cli.parse();
