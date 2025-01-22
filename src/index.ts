#!/usr/bin/env node
import { execSync, spawn } from "child_process";
import fs from "fs";
import path from "path";
import { program } from "commander";
import process from "process";
import blessed from "blessed";
import OpenAI from "openai";

interface Config {
  debug: boolean;
  testCommand: string;
  serializeCommand: string;
  apiKey: string;
  historyFile: string;
  testDirs: string[];
  sourceDirs: string[];
  testFileExt: string;
  systemPromptFile?: string;
  hideReasoning: boolean;
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
  historyFile: path.join(process.cwd(), ".askai_history.json"),
  testDirs: ["test", "tests"],
  sourceDirs: ["src"],
  testFileExt: ".ts",
  systemPromptFile: "",
  hideReasoning: false,
};

const ui = createBlessedUI();

function loadConfig(): Config {
  program
    .version("1.0.0")
    .option("--debug", "Enable debug mode")
    .option("--serialize <command>", "Repository serialization command")
    .option("--system-prompt <file>", "Path to system prompt file")
    .option("--hide-reasoning", "Hide reasoning content")
    .arguments("[testCommand...]")
    .action((testCommand) => {
      program.opts().testCommand = testCommand.join(" ");
    })
    .parse(process.argv);

  const apiKey = process.env.DEEPSEEK_API_KEY;
  if (!apiKey) {
    console.error("Error: DEEPSEEK_API_KEY environment variable is required");
    process.exit(1);
  }

  return {
    ...DEFAULT_CONFIG,
    apiKey,
    debug: program.opts().debug || false,
    serializeCommand:
      program.opts().serialize || DEFAULT_CONFIG.serializeCommand,
    testCommand: program.opts().testCommand,
    systemPromptFile: program.opts().systemPrompt,
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
      stdio: "pipe",
    });
    let output = "";

    proc.stdout.on("data", (data) => (output += data.toString()));
    proc.stderr.on("data", (data) => (output += data.toString()));

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
      ui.outputScreen.setContent(`Running test command: ${testCommand}`);
    }
    return await executeCommand(cmd, args);
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
    ui.outputScreen.setContent(`Serialized repository size: ${result.length}`);
  }
  return result;
}

function findTestFiles(output: string, config: Config): string[] {
  const failedTests = new Set(
    output
      .split("\n")
      .filter((line) => line.toLowerCase().includes("fail"))
      .map((line) => line.match(/\b(test\w*)\b/)?.[1])
      .filter(Boolean) as string[]
  );

  const searchDirs = [...config.testDirs, ...config.sourceDirs]
    .map((dir) => path.resolve(process.cwd(), dir))
    .filter((dir) => fs.existsSync(dir));
  const testFiles = new Set<string>();

  for (const test of failedTests) {
    for (const dir of searchDirs) {
      try {
        const files = fs.readdirSync(dir, { recursive: true });
        files.forEach((file) => {
          if (
            typeof file === "string" &&
            file.endsWith(config.testFileExt) &&
            fs.readFileSync(path.join(dir, file), "utf8").includes(test)
          ) {
            testFiles.add(path.join(dir, file));
          }
        });
      } catch (error) {
        ui.outputScreen.setContent(`Error searching ${dir}: ${error}`);
      }
    }
  }

  return Array.from(testFiles);
}

async function getChatHistory(config: Config): Promise<Message[]> {
  try {
    const content = await fs.promises.readFile(config.historyFile, "utf8");
    return JSON.parse(content);
  } catch {
    return [
      {
        role: "system",
        content: config.systemPromptFile
          ? fs.existsSync(config.systemPromptFile)
            ? fs.readFileSync(config.systemPromptFile, "utf8")
            : DEFAULT_PROMPT
          : DEFAULT_PROMPT,
      },
    ];
  }
}

interface BlessedUI {
  screen: blessed.Widgets.Screen;
  outputScreen: blessed.Widgets.BoxElement;
  reasoningLog: blessed.Widgets.BoxElement;
}

function createBlessedUI(): BlessedUI {
  const screen = blessed.screen({
    smartCSR: true,
    title: "DeepSeek Test Analyzer",
  });

  const testResultsLog = blessed.box({
    parent: screen,
    top: 0,
    left: 0,
    width: "100%",
    height: "50%",
    content: "",
    border: {
      type: "line",
    },
    label: " Test Results ",
    mouse: true,
    scrollable: true,
    alwaysScroll: true,
  });

  const reasoningLog = blessed.box({
    parent: screen,
    top: "50%",
    left: 0,
    width: "100%",
    height: "50%",
    content: "",
    border: {
      type: "line",
    },
    label: " Reasoning ",
    mouse: true,
    scrollable: true,
    alwaysScroll: true,
  });

  screen.key(["escape", "q", "C-c"], () => {
    screen.destroy();
    process.exit(0);
  });

  screen.render();

  return { screen, outputScreen: testResultsLog, reasoningLog };
}

function debug(...messages: string[]) {
  ui.outputScreen.setContent(
    `${ui.outputScreen.getContent()}\n${messages.join("\n")}`
  );
  ui.screen.render();
  fs.appendFileSync("log.txt", messages.join("\n"));
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
      ui.reasoningLog.setContent(ui.reasoningLog.getContent() + displayText);
      ui.screen.render();
    }
  }

  // Prioritize content over reasoning for final response
  return fullContent || fullReasoning;
}

async function getGitDiff(config: Config) {
  const diff = execSync("git diff | cat", { stdio: "pipe" }).toString();
  if (diff.includes("No such file or directory")) {
    return "";
  }
  if (config.debug) {
    const currentContent = ui.outputScreen.getContent();
    ui.outputScreen.setContent(`${currentContent}\nGit Diff:\n${diff}`);
    ui.screen.render();
  }
  return diff;
}

async function main() {
  const config = loadConfig();
  if (config.debug) {
    const debugContent = `Configuration: ${JSON.stringify(config)}`;
    ui.outputScreen.setContent(debugContent);
    ui.screen.render();
  }

  try {
    const [testOutput, repoStructure, gitDiff] = await Promise.all([
      runTestCommand(config.testCommand, config),
      serializeRepository(config.serializeCommand, config),
      getGitDiff(config),
    ]);

    ui.outputScreen.setContent(
      [testOutput, repoStructure, gitDiff].join("\n\n")
    );
    ui.screen.render();

    if (config.debug) {
      const currentContent = ui.outputScreen.getContent();
      ui.outputScreen.setContent(`${currentContent}\ngitDiff: ${gitDiff}`);
      ui.screen.render();
    }

    const testFiles = findTestFiles(testOutput, config);
    const testContents = testFiles
      .map((file) => `// ${file}\n${fs.readFileSync(file, "utf8")}`)
      .join("\n\n");

    const messages = await getChatHistory(config);
    messages.push({
      role: "user",
      content: [
        `## Repository Structure\n${repoStructure}`,
        `## Test Output\n${testOutput}`,
        `## Git Diff\n${gitDiff}`,
        `## Test Files\n${testContents}`,
      ].join("\n\n"),
    });

    const currentContent = ui.outputScreen.getContent();
    ui.outputScreen.setContent(`${currentContent}\nAnalyzing test failures...`);
    ui.screen.render();

    const aiResponses = await streamAIResponse(config, messages);

    await fs.promises.writeFile(
      config.historyFile,
      JSON.stringify(
        [...messages, { role: "assistant", content: aiResponses }],
        null,
        2
      )
    );

    ui.outputScreen.destroy();
    ui.reasoningLog.destroy();
    ui.screen.destroy();
    console.log(aiResponses);
  } catch (error) {
    ui.outputScreen.destroy();
    ui.reasoningLog.destroy();
    ui.screen.destroy();
    console.error("Error:", error);
  }
}

main().catch(console.error);
