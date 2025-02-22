#!/usr/bin/env node

import process from "node:process";
import { ui } from "./ui.js";
import { cli } from "./cli.js";
import { loadConfig, loadRepoData } from "./commands.js";
import { Config } from "./types.js";
import { analyzeTestFailure, applyAiFixes } from "./fix.js";

process.on("SIGINT", () => {
  ui.destroy();
  process.exit(0);
});

cli.action(async (testCommandAndArgs: string[], options: Config) => {
  const config = loadConfig(testCommandAndArgs, options);

  // Initialize UI before starting commands
  if (!config.hideUi) {
    ui.initialize();
  }

  const { testOutput, repoStructure, gitDiff } = await loadRepoData(config);
  const analysis = await analyzeTestFailure(
    config,
    testOutput,
    repoStructure,
    gitDiff
  );

  // If fix requested, apply changes
  if (config.fix) {
    await ui.destroy();
    const fixConfig = {
      ...config,
      testOutput,
      repoStructure,
    };

    const results = await applyAiFixes(fixConfig, {
      autoApply: config.autoApply,
      analysis,
    });

    const totalFilesFixed = results.filter(Boolean).length;
    const appliedAnyFixes = totalFilesFixed > 0;

    if (appliedAnyFixes) {
      console.log(
        `Fixed ${totalFilesFixed} files out of ${results.length} files.`
      );
    } else {
      console.log("No fixes were applied.");
    }

    process.exit(appliedAnyFixes ? 0 : 1);
  } else {
    ui.destroy();
    process.stdout.write(analysis);
    process.exit(0);
  }
});

cli.parse();
