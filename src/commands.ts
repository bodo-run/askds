import { execSync, spawn } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import process from "node:process";

import fastGlob from "fast-glob";
import globToRegexp from "glob-to-regexp";

import { Config } from "./types.js";
import { ui } from "./ui.js";

export function loadConfig(testCommandAndArgs: string[], options: any): Config {
  const testCommand = testCommandAndArgs.join(" ");

  if (!testCommand) {
    console.error("No test command provided");
    process.exit(1);
  }

  return {
    ...options,
    testCommand,
    timeout: Number.parseInt(options.timeout, 10) * 1000,
  };
}

export async function executeCommand(
  command: string,
  args: string[],
  options: {
    shell: boolean;
    onData?: (data: string) => void;
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
    const handleData = (data: Buffer) => {
      const text = data.toString();
      output += text;
      options.onData?.(text);
    };

    proc.stdout.on("data", handleData);
    proc.stderr.on("data", handleData);

    proc.on("close", (code) => {
      code === 0
        ? resolve(output)
        : reject(new Error(`Command failed with code ${code}\n${output}`));
    });
  });
}

export async function runTestCommand(
  testCommand: string,
  config: Config
): Promise<string> {
  const [cmd, ...args] = testCommand.split(/\s+/);
  try {
    if (config.debug) {
      ui.appendOutputLog(`Running test command: ${testCommand}`);
    }

    const output = await executeCommand(cmd, args, {
      shell: true,
      onData: (data) => {
        ui.appendOutputLog(`${data}\n`);
        if (config.debug) {
          ui.appendReasoningLog(`Received ${data.length} bytes from tests...`);
        }
      },
    });

    return output;
  } catch (error) {
    return error instanceof Error ? error.message : String(error);
  }
}

export async function serializeRepository(
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

export function findTestFiles(output: string, config: Config): string[] {
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

export async function getGitDiff(config: Config): Promise<string> {
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

export async function loadRepoData(config: Config) {
  return Promise.all([
    serializeRepository(config.serialize, config),
    runTestCommand(config.testCommand, config),
    getGitDiff(config),
  ]).then(([repoStructure, testOutput, gitDiff]) => ({
    repoStructure,
    testOutput,
    gitDiff,
  }));
}
