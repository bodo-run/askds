#!/usr/bin/env node

import process from "node:process";
import fs from "node:fs";
import { ui } from "./ui.js";
import { cli } from "./cli.js";
import { loadConfig, loadRepoData } from "./commands.js";
import { Config } from "./types.js";
import { analyzeTestFailure, applyAiFixes } from "./fix.js";
import path from "node:path";

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

  const cachePath = path.join(
    process.cwd(),
    "node_modules",
    ".cache",
    "cache.json"
  );
  fs.mkdirSync(path.dirname(cachePath), { recursive: true });

  let analysis, testOutput, repoStructure, gitDiff;

  // Try to load from cache first
  if (fs.existsSync(cachePath) && config.cache) {
    try {
      const cached = JSON.parse(fs.readFileSync(cachePath, "utf8"));
      ({ analysis, testOutput, repoStructure, gitDiff } = cached);
    } catch (e) {
      console.log("Cache invalid, regenerating...");
    }
  }

  // If not cached or cache invalid, generate fresh data
  if (!config.cache) {
    ({ testOutput, repoStructure, gitDiff } = await loadRepoData(config));
    analysis = await analyzeTestFailure(
      config,
      testOutput,
      repoStructure,
      gitDiff
    );

    // Cache the results
    fs.writeFileSync(
      cachePath,
      JSON.stringify(
        {
          analysis,
          testOutput,
          repoStructure,
          gitDiff,
        },
        null,
        2
      )
    );
  }

  // If fix requested, apply changes
  if (config.fix) {
    await ui.destroy();
    const fixConfig = {
      ...config,
      testOutput,
      repoStructure,
    };

    const success = await applyAiFixes(fixConfig, {
      autoApply: config.autoApply,
      analysis,
    });

    process.exit(success ? 0 : 1);
  } else {
    ui.destroy();
    process.stdout.write(analysis);
    process.exit(0);
  }
});

cli.parse();
