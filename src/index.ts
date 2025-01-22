#!/usr/bin/env node
import { spawn, execSync } from "child_process";
import { createInterface } from "readline";
import https from "https";
import fs from "fs";
import path from "path";
import { program } from "commander";
import process from "process";

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
};

function loadConfig(): Config {
  program
    .version("1.0.0")
    .option("--debug", "Enable debug mode")
    .option("--serialize <command>", "Repository serialization command")
    .option("--system-prompt <file>", "Path to system prompt file")
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
  args: string[]
): Promise<string> {
  return new Promise((resolve, reject) => {
    const proc = spawn(command, args, { shell: true });
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

async function runTestCommand(testCommand: string): Promise<string> {
  const [cmd, ...args] = testCommand.split(/\s+/);
  try {
    return await executeCommand(cmd, args);
  } catch (error) {
    return error instanceof Error ? error.message : String(error);
  }
}

async function serializeRepository(command: string): Promise<string> {
  const [cmd, ...args] = command.split(/\s+/);
  return executeCommand(cmd, args);
}

function findTestFiles(output: string, config: Config): string[] {
  const failedTests = new Set(
    output
      .split("\n")
      .filter((line) => line.toLowerCase().includes("fail"))
      .map((line) => line.match(/\b(test\w*)\b/)?.[1])
      .filter(Boolean) as string[]
  );

  const searchDirs = [...config.testDirs, ...config.sourceDirs];
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
        if (config.debug) console.error(`Error searching ${dir}: ${error}`);
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

async function streamAIResponse(
  config: Config,
  messages: Message[]
): Promise<string> {
  return new Promise((resolve, reject) => {
    const req = https.request(
      {
        hostname: "api.deepseek.com",
        path: "/chat/completions",
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${config.apiKey}`,
        },
      },
      (res) => {
        let response = "";
        res.on("data", (chunk) => {
          const chunkStr = chunk.toString();
          process.stdout.write(chunkStr);
          response += chunkStr;
        });
        res.on("end", () => resolve(response));
      }
    );

    req.on("error", reject);
    req.write(
      JSON.stringify({
        model: "deepseek-reasoner",
        messages,
        stream: true,
      })
    );
    req.end();
  });
}

async function main() {
  const config = loadConfig();
  if (config.debug) console.debug("Configuration:", config);

  try {
    const [testOutput, repoStructure, gitDiff] = await Promise.all([
      runTestCommand(config.testCommand),
      serializeRepository(config.serializeCommand),
      executeCommand("git", ["diff"]),
    ]);

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

    console.log("\nAnalyzing test failures...");
    const aiResponse = await streamAIResponse(config, messages);

    await fs.promises.writeFile(
      config.historyFile,
      JSON.stringify(
        [...messages, { role: "assistant", content: aiResponse }],
        null,
        2
      )
    );
  } catch (error) {
    console.error(
      "\nError:",
      error instanceof Error ? error.message : String(error)
    );
    process.exit(1);
  }
}

main();
