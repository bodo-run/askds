#!/usr/bin/env node
import { execSync, spawn } from "child_process";
import fs from "fs";
import path from "path";
import { program } from "commander";
import process from "process";
import blessed from "blessed";
import contrib from "blessed-contrib";
import OpenAI from "openai";
import fastGlob from "fast-glob";

interface Config {
  debug: boolean;
  testCommand: string;
  serializeCommand: string;
  apiKey: string;
  testDirs: string[];
  sourceDirs: string[];
  testFileExt: string;
  systemPromptFile?: string;
  hideReasoning: boolean;
  testFilePattern?: string;
  sourceFilePattern?: string;
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

const DEFAULT_CONFIG: Omit<Config, "apiKey" | "testCommand"> = {
  debug: false,
  serializeCommand: "yek",
  testDirs: ["test", "tests"],
  sourceDirs: ["src"],
  testFileExt: ".ts",
  systemPromptFile: "",
  hideReasoning: false,
};

const ui = createBlessedUI();

function loadConfig(): Config {
  program
    .option("--debug", "Enable debug mode")
    .option("--serialize <command>", "Command to serialize repository")
    .option("--test-dirs <dirs>", "Test directories")
    .option("--source-dirs <dirs>", "Source directories")
    .option("--test-file-ext <ext>", "Test file extension")
    .option("--system-prompt <file>", "System prompt file")
    .option("--hide-reasoning", "Hide AI reasoning")
    .option("--test-file-pattern <pattern>", "Glob pattern for test files")
    .option("--source-file-pattern <pattern>", "Glob pattern for source files");

  program.parse();

  const options = program.opts();
  const testCommand = program.args.join(" ");

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
    testDirs: options.testDirs?.split(",") ?? DEFAULT_CONFIG.testDirs,
    sourceDirs: options.sourceDirs?.split(",") ?? DEFAULT_CONFIG.sourceDirs,
    testFileExt: options.testFileExt ?? DEFAULT_CONFIG.testFileExt,
    systemPromptFile: options.systemPrompt ?? DEFAULT_CONFIG.systemPromptFile,
    hideReasoning: options.hideReasoning ?? DEFAULT_CONFIG.hideReasoning,
    testFilePattern: options.testFilePattern,
    sourceFilePattern: options.sourceFilePattern,
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
      stdio: ["inherit", "pipe", "pipe"], // Preserve stdout configuration
      env: { ...process.env, FORCE_COLOR: "1" }, // Force color output
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
  if (!output) {
    ui.appendOutputLog("No test output detected");
    return [];
  }

  const failedTests = new Set(
    output
      .split("\n")
      .filter((line) => /(fail|error|❌|×)/i.test(line))
      .map((line) => line.match(/\b(test\w*)\b/)?.[1])
      .filter(Boolean) as string[]
  );

  let testFiles: string[] = [];

  if (config.testFilePattern) {
    testFiles = fastGlob.sync(config.testFilePattern, {
      absolute: true,
      cwd: process.cwd(),
    });
    if (config.debug) {
      ui.appendOutputLog(`Found test files via glob: ${testFiles.join(", ")}`);
    }
  } else {
    const searchDirs = [...config.testDirs, ...config.sourceDirs]
      .map((dir) => path.resolve(process.cwd(), dir))
      .filter((dir) => fs.existsSync(dir));

    for (const dir of searchDirs) {
      try {
        const files = fs.readdirSync(dir, { recursive: true });
        files.forEach((file) => {
          if (typeof file === "string" && file.endsWith(config.testFileExt)) {
            testFiles.push(path.join(dir, file));
          }
        });
      } catch (error) {
        ui.appendOutputLog(`Error searching ${dir}: ${error}`);
      }
    }
  }

  const matchingFiles = testFiles.filter((file) => {
    try {
      const content = fs.readFileSync(file, "utf8");
      return Array.from(failedTests).some((test) => content.includes(test));
    } catch (error) {
      ui.appendOutputLog(`Error reading ${file}: ${error}`);
      return false;
    }
  });

  return matchingFiles;
}

async function getGitDiff(config: Config) {
  const diff = execSync("git diff | cat", { stdio: "pipe" }).toString();
  if (diff.includes("No such file or directory")) {
    return "";
  }
  if (config.debug) {
    ui.appendOutputLog(`Git Diff:\n${diff}`);
  }
  return diff;
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
    baseURL: "https://api.deepseek.com", // Fixed base URL
  });

  const stream = await openai.chat.completions.create({
    model: "deepseek-reasoner",
    messages,
    stream: true,
  });

  let fullContent = "";
  let fullReasoning = "";

  for await (const chunk of stream) {
    // Handle both content and reasoning_content
    const contentChunk = chunk.choices[0]?.delta?.content || "";
    // @ts-ignore
    const reasoningChunk = chunk.choices[0]?.delta?.reasoning_content || "";

    fullContent += contentChunk;
    fullReasoning += reasoningChunk;

    // Display reasoning content if not hidden
    if (!config.hideReasoning) {
      const displayText = reasoningChunk || contentChunk;
      ui.appendReasoningLog(displayText);
    }
  }

  // Prioritize content over reasoning for final response
  return fullContent || fullReasoning;
}

async function main() {
  const config = loadConfig();

  process.on("SIGINT", () => {
    ui.destroy();
    process.exit(0);
  });

  // Initialize UI only if:
  // 1. Reasoning is not hidden
  // 2. We're in a TTY environment
  if (!config.hideReasoning) {
    ui.initialize();

    // If we're not in a TTY environment, force hide reasoning
    if (!process.stdin.isTTY || !process.stdout.isTTY) {
      config.hideReasoning = true;
    }
  }

  if (config.debug) {
    ui.appendOutputLog(`Configuration: ${JSON.stringify(config)}`);
  }

  try {
    const [testOutput, repoStructure, gitDiff] = await Promise.all([
      runTestCommand(config.testCommand, config),
      serializeRepository(config.serializeCommand, config),
      getGitDiff(config),
    ]);

    ui.appendOutputLog(testOutput);

    if (config.debug) {
      ui.appendReasoningLog(`gitDiff: ${gitDiff}`);
    }

    const testFiles = findTestFiles(testOutput, config);
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
          `## Test Output\n${testOutput}`,
          `## Git Diff\n${gitDiff}`,
          `## Test Files\n${testContents}`,
        ].join("\n\n"),
      },
    ];

    ui.appendReasoningLog("Analyzing test failures...\n");
    const aiResponses = await streamAIResponse(config, messages);

    ui.destroy();
    console.log(aiResponses);
  } catch (error) {
    ui.destroy();
    console.error("Error:", error);
  }
}

main().catch(console.error);
