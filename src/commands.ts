import { execSync, spawn } from "node:child_process";
import process from "node:process";
import fastGlob from "fast-glob";

import { Config } from "./types.js";
import { ui } from "./ui.js";

export function loadConfig(testCommandAndArgs: string[], options: any): Config {
  options.timeout = Number.parseInt(options.timeout, 10) * 1000;
  if (options.run) {
    return {
      ...options,
      testCommand: options.run,
    };
  }

  const testCommand = testCommandAndArgs.join(" ");

  if (!testCommand) {
    console.error("No test command provided");
    process.exit(1);
  }

  return {
    ...options,
    testCommand,
  };
}

export async function executeCommand(
  command: string,
  args: string[],
  options: {
    shell: boolean;
    onData?: (data: string) => void;
    onEnd?: () => void;
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
      options.onEnd?.();
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
      ui.appendOutputLog(`Running test command: ${testCommand}\n`);
    }

    const output = await executeCommand(cmd, args, {
      shell: true,
      onData: (data) => {
        ui.appendOutputLog(data);
        if (config.debug) {
          ui.appendReasoningLog(
            `Received ${data.length} bytes from tests...\n`
          );
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
    ui.appendOutputLog(`Serialized repository size: ${result.length}\n`);
  }
  return result;
}

export function findTestFiles(
  output: string,
  config: Config
): string[] {
  // Get test files from glob pattern
  const testFiles = fastGlob.sync(config.testFilePattern, {
    ignore: ["**/node_modules/**"],
    absolute: false,
    cwd: process.cwd(),
  });

  // Extract test files from output
  const outputLines = output.split("\n");
  const matchedFiles = testFiles.filter((file) =>
    outputLines.some((line) => line.includes(file))
  );

  ui.appendOutputLog(
    `\nFound ${matchedFiles.length.toLocaleString()} test files referenced in test output. Will include them in the context.\n\n`
  );

  return matchedFiles;
}

export async function getGitDiff(config: Config): Promise<string> {
  try {
    const diff = execSync("git diff --staged", { stdio: "pipe" }).toString();
    if (config.debug) {
      ui.appendOutputLog(`Git Diff:\n${diff}\n`);
    }
    return diff;
  } catch (error) {
    if (config.debug) {
      ui.appendOutputLog(
        `Git Diff Error: ${
          error instanceof Error ? error.message : String(error)
        }\n`
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
