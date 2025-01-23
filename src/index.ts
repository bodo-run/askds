#!/usr/bin/env node
import packageJson from "../package.json" assert { type: "json" };
import { execSync, spawn } from "node:child_process";
import fs from "node:fs";
import process from "node:process";
import path from "node:path";

import { program } from "commander";
import blessed from "blessed";
import contrib from "blessed-contrib";
import OpenAI from "openai";
import fastGlob from "fast-glob";
import globToRegexp from "glob-to-regexp";

interface Config {
  debug: boolean;
  testCommand: string;
  serializeCommand: string;
  apiKey: string;
  systemPromptFile?: string;
  hideReasoning: boolean;
  testFilePattern: string[];
  sourceFilePattern: string[];
  timeout: number;
}

interface Message {
  role: "system" | "user" | "assistant";
  content: string;
}

const DEFAULT_PROMPT = [
  "You are a senior software engineer helping debug test failures. Analyze:",
  "1. Test output",
  "2. Repository structure",
  "3. Code changes (git diff)",
  "4. Relevant test files",
  "Provide concise, actionable solutions.",
].join("\n");

const DEFAULT_TEST_FILE_PATTERN = [
  "**/*.{test,spec}.*",
  "**/*.{tests,specs}.*",
  "**/__tests__/**/*",
  "**/__test__/**/*",
  "**/test/**/*",
  "**/tests/**/*",
];

const DEFAULT_CONFIG: Omit<Config, "apiKey" | "testCommand"> = {
  debug: false,
  serializeCommand: "yek",
  systemPromptFile: "",
  hideReasoning: false,
  testFilePattern: DEFAULT_TEST_FILE_PATTERN,
  sourceFilePattern: DEFAULT_TEST_FILE_PATTERN.map((pattern) => `!${pattern}`),
  timeout: 2 * 60 * 1000, // 2 minutes
};

const ui = createBlessedUI();

function loadConfig(): Config {
  program
    .version(packageJson.version)
    .enablePositionalOptions(true)
    .passThroughOptions(true)
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
    )
    .argument("[test-command-and-args...]", "Test command to execute")
    .action((testCommandAndArgs) => {
      program.opts().testCommand = testCommandAndArgs.join(" ");
    });

  program.parse();

  const options = program.opts();
  const testCommand = options.testCommand;

  if (!testCommand) {
    console.error("No test command provided");
    process.exit(1);
  }

  const apiKey = process.env.DEEPSEEK_API_KEY;
  if (!apiKey) {
    console.error("DEEPSEEK_API_KEY environment variable not set");
    process.exit(1);
  }

  return {
    debug: options.debug ?? DEFAULT_CONFIG.debug,
    testCommand,
    serializeCommand: options.serialize ?? DEFAULT_CONFIG.serializeCommand,
    apiKey,
    systemPromptFile: options.systemPrompt ?? DEFAULT_CONFIG.systemPromptFile,
    hideReasoning: options.hideReasoning ?? DEFAULT_CONFIG.hideReasoning,
    testFilePattern: options.testFilePattern ?? DEFAULT_CONFIG.testFilePattern,
    sourceFilePattern:
      options.sourceFilePattern ?? DEFAULT_CONFIG.sourceFilePattern,
    timeout: Number.parseInt(options.timeout, 10) * 1000,
  };
}

async function executeCommand(
  command: string,
  args: string[],
  options: {
    shell: boolean;
  } = {
    shell: true,
  }
): Promise<string> {
  return new Promise((resolve, reject) => {
    const proc = spawn(command, args, {
      shell: options.shell,
      stdio: ["inherit", "pipe", "pipe"],
      env: { ...process.env, FORCE_COLOR: "1" },
    });

    let output = "";
    proc.stdout.on("data", (data) => {
      output += data.toString();
    });

    proc.stderr.on("data", (data) => {
      output += data.toString();
    });

    proc.on("close", (code) => {
      code === 0
        ? resolve(output)
        : reject(new Error(`Command failed with code ${code}\n${output}`));
    });
  });
}

async function runTestCommand(
  testCommand: string,
  config: Config
): Promise<string> {
  const [cmd, ...args] = testCommand.split(/\s+/);
  try {
    if (config.debug) {
      ui.appendOutputLog(`Running test command: ${testCommand}`);
    }
    const output = await executeCommand(cmd, args);
    return output;
  } catch (error) {
    return error instanceof Error ? error.message : String(error);
  }
}

async function serializeRepository(
  command: string,
  config: Config
): Promise<string> {
  const [cmd, ...args] = command.split(/\s+/);
  const result = await executeCommand(cmd, args);
  if (config.debug) {
    ui.appendOutputLog(`Serialized repository size: ${result.length}`);
  }
  return result;
}

function findTestFiles(output: string, config: Config): string[] {
  const matchedFiles = new Set<string>();
  const cwd = process.cwd();

  // 1. Convert test file patterns to regex patterns without anchors
  const testFileRegexes = config.testFilePattern.map((pattern) => {
    const regex = globToRegexp(pattern, {
      globstar: true,
      extended: true,
      flags: "i",
    });

    // Remove ^/$ anchors to match anywhere in line
    const source = regex.source.replace(/^\^/, "").replace(/\$$/, "");

    return new RegExp(source, regex.flags);
  });

  // 2. Scan each output line for matching paths
  output.split("\n").forEach((line) => {
    testFileRegexes.forEach((regex) => {
      const matches = line.match(regex);
      if (matches?.[0]) {
        const matchedPath = matches[0];

        // Try both relative and absolute paths
        const pathsToCheck = [matchedPath, path.join(cwd, matchedPath)];

        for (const filePath of pathsToCheck) {
          if (fs.existsSync(filePath)) {
            matchedFiles.add(path.relative(cwd, filePath));
            break;
          }
        }
      }
    });
  });

  // 3. Fallback to pattern matching if no explicit matches found
  if (matchedFiles.size === 0) {
    const allTestFiles = fastGlob.sync(config.testFilePattern, {
      cwd,
      absolute: false,
      ignore: ["**/node_modules/**"],
    });

    allTestFiles.forEach((file) => {
      if (output.includes(file)) {
        matchedFiles.add(file);
      }
    });
  }

  if (config.debug) {
    ui.appendOutputLog(
      [
        `Test file detection results:`,
        `- Output lines scanned: ${output.split("\n").length}`,
        `- Patterns used: ${config.testFilePattern.join(", ")}`,
        `- Matched files: ${Array.from(matchedFiles).join(", ") || "none"}`,
      ].join("\n")
    );
  }

  return Array.from(matchedFiles);
}

async function getGitDiff(config: Config): Promise<string> {
  try {
    const diff = execSync("git diff --staged", { stdio: "pipe" }).toString();
    if (config.debug) {
      ui.appendOutputLog(`Git Diff:\n${diff}`);
    }
    return diff;
  } catch (error) {
    if (config.debug) {
      ui.appendOutputLog(
        `Git Diff Error: ${
          error instanceof Error ? error.message : String(error)
        }`
      );
    }
    return "";
  }
}

const filterCursorCodes = (text: string) => text.replace(/\x1B\[\?25[hl]/g, "");

interface BlessedUI {
  initialize: () => void;
  appendOutputLog: (text: string) => void;
  appendReasoningLog: (text: string) => void;
  render: () => void;
  destroy: () => void;
}

function createBlessedUI(): BlessedUI {
  let initialized = false;
  let screen: blessed.Widgets.Screen | undefined;
  let grid: contrib.grid | undefined;
  let outputLog: contrib.Widgets.LogElement | undefined;
  let reasoningLog: contrib.Widgets.LogElement | undefined;

  function initialize() {
    if (initialized) return;

    // Check if we're in a TTY environment
    if (!process.stdin.isTTY || !process.stdout.isTTY) {
      return;
    }

    try {
      initialized = true;
      screen = blessed.screen({
        smartCSR: true,
        title: "DeepSeek Test Analyzer",
        fullUnicode: true,
        terminal: "xterm-256color",
      });

      grid = new contrib.grid({
        rows: 2,
        cols: 1,
        screen,
      });

      outputLog = grid.set(0, 0, 1, 1, contrib.log, {
        label: " Test Results ",
        bufferLength: 1000,
        scrollable: true,
        input: true,
        mouse: true,
        keys: true,
        ansi: true,
        scrollbar: true,
        style: {
          fg: "inherit",
          bg: "inherit",
          border: { fg: "cyan" },
        },
      });

      reasoningLog = grid.set(1, 0, 1, 1, contrib.log, {
        label: " Reasoning ",
        bufferLength: 1000,
        scrollable: true,
        input: true,
        mouse: true,
        keys: true,
        ansi: true,
        scrollbar: true,
        style: {
          text: "gray",
          bg: "inherit",
          fg: "inherit",
          border: { fg: "green" },
        },
      });

      screen.key(["escape", "q", "C-c"], () => {
        destroy();
        process.exit(0);
      });
    } catch (error) {
      initialized = false;
      console.error("Failed to initialize UI:", error);
    }
  }

  function appendOutputLog(text: string) {
    try {
      if (!initialized || !outputLog) {
        console.log("[OUTPUT]", text);
        return;
      }
      outputLog.setContent(outputLog.getContent() + filterCursorCodes(text));
      outputLog.scrollTo(outputLog.getScrollHeight());
      render();
    } catch (e) {
      console.error("UI Error:", e);
      console.log("[OUTPUT]", text);
    }
  }

  function appendReasoningLog(text: string) {
    try {
      if (!initialized || !reasoningLog) {
        console.log("[REASONING]", text);
        return;
      }
      reasoningLog.setContent(
        reasoningLog.getContent() + filterCursorCodes(text)
      );
      reasoningLog.scrollTo(reasoningLog.getScrollHeight());
      render();
    } catch (e) {
      console.error("UI Error:", e);
      console.log("[REASONING]", text);
    }
  }

  function render() {
    if (!initialized || !screen) {
      return;
    }
    screen.render();
  }

  function destroy() {
    if (initialized && screen) {
      try {
        screen.destroy();
        process.stdout.write("\x1B[0m\x1Bc"); // Clear screen
      } catch (error) {
        console.error("Error cleaning up UI:", error);
      }
      initialized = false;
    }
  }

  return {
    initialize,
    appendOutputLog,
    appendReasoningLog,
    render,
    destroy,
  };
}

async function streamAIResponse(
  config: Config,
  messages: Message[]
): Promise<string> {
  const openai = new OpenAI({
    apiKey: config.apiKey,
    baseURL: "https://api.deepseek.com",
  });

  // const controller = new AbortController();

  // const timeoutId = setTimeout(() => controller.abort(), config.timeout);

  try {
    if (config.debug) {
      ui.appendOutputLog("Sending messages to AI...");
    }
    const stream = await openai.chat.completions.create(
      {
        model: "deepseek-reasoner",
        messages,
        stream: true,
      },
      {
        // signal: controller.signal,
      }
    );

    if (config.debug) {
      ui.appendOutputLog("AI response stream started");
    }

    let fullContent = "";
    let fullReasoning = "";
    let chunkCount = 0;

    for await (const chunk of stream) {
      chunkCount++;
      const contentChunk = chunk.choices[0]?.delta?.content || "";
      const reasoningChunk =
        (chunk as any).choices[0]?.delta?.reasoning_content || "";

      if (config.debug) {
        // every 25 chunks
        if (chunkCount % 25 === 0) {
          ui.appendOutputLog(
            `Received ${chunkCount} chunks. Content: ${contentChunk.length}b, Reasoning: ${reasoningChunk.length}b`
          );
        }
      }

      fullContent += contentChunk;
      fullReasoning += reasoningChunk;

      if (!config.hideReasoning) {
        const displayText = reasoningChunk || contentChunk;
        ui.appendReasoningLog(displayText);
      }
    }

    // clearTimeout(timeoutId);
    return fullContent || fullReasoning;
  } catch (error: unknown) {
    // clearTimeout(timeoutId);
    if (error instanceof Error && error.name === "AbortError") {
      throw new Error(
        `API request timed out after ${config.timeout / 1000} seconds`
      );
    }
    if (config.debug) {
      ui.appendOutputLog(
        `API Error: ${error instanceof Error ? error.message : String(error)}`
      );
    }
    throw error;
  }
}

async function main() {
  const config = loadConfig();
  process.on("SIGINT", () => {
    ui.destroy();
    process.exit(0);
  });

  if (!config.hideReasoning) {
    ui.initialize();
    if (!process.stdin.isTTY || !process.stdout.isTTY) {
      config.hideReasoning = true;
    }
  }

  try {
    const [testOutput, repoStructure, gitDiff] = await Promise.all([
      runTestCommand(config.testCommand, config),
      serializeRepository(config.serializeCommand, config),
      getGitDiff(config),
    ]);

    ui.appendOutputLog(testOutput);
    const testFiles = findTestFiles(testOutput, config);

    if (testFiles.length === 0) {
      ui.appendOutputLog(
        `\n{WARN} No test files found matching failure ${config.testFilePattern}`
      );
      ui.appendOutputLog(
        "You can specify test file patterns with --test-file-pattern"
      );
      ui.appendOutputLog(
        "Moving forward without having any test files anyways..."
      );
    }

    const testContents = testFiles
      .map((file) => `// ${file}\n${fs.readFileSync(file, "utf8")}`)
      .join("\n\n");

    const messages: Message[] = [
      {
        role: "system",
        content: config.systemPromptFile
          ? fs.existsSync(config.systemPromptFile)
            ? fs.readFileSync(config.systemPromptFile, "utf8")
            : DEFAULT_PROMPT
          : DEFAULT_PROMPT,
      },
      {
        role: "user",
        content: [
          `## Repository Structure\n${repoStructure}`,
          `## Output of running ${config.testCommand}\n${testOutput}`,
          gitDiff ? `## Git Diff\n${gitDiff}` : "",
          testFiles.length ? `## Test Files\n${testContents}` : ``,
        ].join("\n\n"),
      },
    ];

    ui.appendReasoningLog("Analyzing test failures...\n");
    const aiResponses = await streamAIResponse(config, messages);

    ui.destroy();
    process.stdout.write(`${aiResponses}\n`);
  } catch (error) {
    ui.destroy();
    console.error(
      "Error:",
      error instanceof Error ? error.message : String(error)
    );
    process.exit(1);
  }
}

main().catch(console.error);
