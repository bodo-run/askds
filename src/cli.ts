import { program } from "commander";

import { DEFAULT_CONFIG } from "./constants.js";

export const cli = program
  .name("askai")
  .description("AI-powered test runner and fixer")
  .argument("[test-command-and-args...]", "Test command to execute")
  .option("--fix", "Automatically apply AI-suggested fixes")
  .option(
    "--interactive",
    "Confirm each change before applying (requires --fix)"
  )
  .option("--debug", "Enable debug mode")
  .option("--serialize <command>", "Repository serialization command")
  .option("--system-prompt <file>", "Path to system prompt file")
  .option("--hide-reasoning", "Hide reasoning UI")
  .option("--timeout <seconds>", "Timeout for AI response", "120")
  .option(
    "--test-file-pattern <pattern>",
    "Glob pattern for test files",
    DEFAULT_CONFIG.testFilePattern
  )
  .option(
    "--source-file-pattern <pattern>",
    "Glob pattern for source files",
    DEFAULT_CONFIG.sourceFilePattern
  );
