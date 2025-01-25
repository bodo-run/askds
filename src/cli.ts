import { program } from "commander";

import { createRequire } from "module";

const require = createRequire(import.meta.url);

const packageJson = require("../package.json");

import { DEFAULT_TEST_FILE_PATTERN } from "./constants.js";

export const cli = program
  .name(packageJson.name)
  .version(packageJson.version)
  .description(packageJson.description)
  .argument("[test-command-and-args...]", "Test command to execute")
  .option(
    "--run <command>",
    "Run this command. when using run [test-command-and-args...] is ignored"
  )
  .option("--fix", "Automatically apply AI-suggested fixes", false)
  .option(
    "--auto-apply",
    "Automatically apply AI-suggested fixes (requires --fix)",
    false
  )
  .option("--debug", "Enable debug mode", false)
  .option("--serialize <command>", "Repository serialization command", "yek")
  .option("--system-prompt <file>", "Path to system prompt file")
  .option("--hide-ui", "Hide UI", false)
  .option("--timeout <seconds>", "Timeout for AI response", "120")
  .option(
    "--test-file-pattern <patterns...>",
    "Glob pattern for test files",
    DEFAULT_TEST_FILE_PATTERN
  )
  .option(
    "--source-file-pattern <patterns...>",
    "Glob pattern for source files",
    ["**/*", ...DEFAULT_TEST_FILE_PATTERN.map((p) => `!${p}`)]
  )
  .showHelpAfterError();
