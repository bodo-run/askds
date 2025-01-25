import { createPatch, ParsedDiff } from "diff";
import prompts from "prompts";
import fs from "node:fs";
import path from "node:path";
import chalk from "chalk";
import { parsePatch } from "diff";
import { streamAIResponse, apis } from "./api.js";
import { findTestFiles } from "./commands.js";
import {
  DEFAULT_PROMPT,
  FIX_PROMPT,
  FILE_PATH_TAG,
  FIX_END_TAG,
  FIX_START_TAG,
} from "./constants.js";
import { Config, Message } from "./types.js";
import { ui } from "./ui.js";

export function extractFixedCode(aiResponse: string): string | null {
  const startTag = "<updated-code>";
  const endTag = "</updated-code>";
  const start = aiResponse.indexOf(startTag);
  const end = aiResponse.indexOf(endTag);

  if (start === -1 || end === -1) return null;

  return aiResponse.slice(start + startTag.length, end).trim();
}

export async function promptConfirmation(
  filePath: string,
  original: string,
  fixed: string
) {
  console.clear();
  console.log(chalk.bold(filePath));
  console.log(highlightChanges(original, fixed));
  const response = await prompts({
    type: "confirm",
    name: "confirm",
    message: chalk.bold(chalk.green("Apply changes?")),
  });

  return response.confirm;
}

export function highlightChanges(original: string, fixed: string): string {
  const diff = createPatch("file", original, fixed, "", "");

  return (parsePatch(diff)[0] as ParsedDiff).hunks
    .map((hunk: { lines: string[] }) =>
      hunk.lines
        .map((line: string) => {
          if (line.startsWith("-")) return `\x1b[31m${line}\x1b[0m`;
          if (line.startsWith("+")) return `\x1b[32m${line}\x1b[0m`;
          return line;
        })
        .join("\n")
    )
    .join("\n");
}

export async function applyAiFixes(
  config: Config,
  options: { autoApply?: boolean; analysis?: string }
): Promise<boolean> {
  const filesToFix = await identifyFixableFiles(options.analysis);

  ui.appendOutputLog(`Fixing ${filesToFix.length} files...`);

  const results = await Promise.all(
    filesToFix.map((file) => processFileFix(file, config, options))
  );

  return results.every((result) => result === true);
}
type FileFix = {
  filePath: string;
  fixedCode: string;
  isComplete: boolean;
};
async function identifyFixableFiles(analysis?: string): Promise<FileFix[]> {
  console.log(analysis);
  const files =
    analysis
      ?.split("\n")
      .map((line) => line.trim())
      .reduce((acc, line) => {
        const last = acc.at(-1);
        const isFilePath = line.startsWith(FILE_PATH_TAG);
        const isFixStart = line.startsWith(FIX_START_TAG);
        const isFixEnd = line.startsWith(FIX_END_TAG);

        if (isFilePath) {
          acc.push({
            filePath: line.slice(FILE_PATH_TAG.length),
            isComplete: false,
            fixedCode: "",
          });
          return acc;
        }
        if (isFixStart && last) {
          last.fixedCode = "";
          return acc;
        }
        if (isFixEnd && last) {
          last.isComplete = true;
          return acc;
        }
        if (last && !last.isComplete) {
          last.fixedCode += line;
          return acc;
        }
        return acc;
      }, [] as FileFix[]) || [];

  return files
    .filter((file) => file.isComplete)
    .filter((file) => file.filePath);
}

async function processFileFix(
  file: FileFix,
  config: Config,
  options: { autoApply?: boolean }
) {
  const fullPath = path.join(process.cwd(), file.filePath);
  const originalContent = await fs.promises.readFile(fullPath, "utf8");

  const messages = createFixMessages(file, originalContent, config);
  ui.appendOutputLog(chalk.bold(`Asking AI to fix ${file.filePath}...`));
  const aiResponse = await streamAIResponse({
    api: apis.FIREWORKS,
    config,
    messages,
  });
  const fixedContent = extractFixedCode(aiResponse);
  if (!fixedContent || fixedContent === originalContent) {
    return false;
  }

  if (!options.autoApply) {
    const confirmed = await promptConfirmation(
      file.filePath,
      originalContent,
      fixedContent
    );
    if (!confirmed) return false;
  }

  ui.appendOutputLog(`Writing fixed content to ${file.filePath}...`);

  // always add a new line at the end of the file if it doesn't already have one
  await fs.promises.writeFile(
    fullPath,
    fixedContent + (fixedContent.endsWith("\n") ? "" : "\n"),
    "utf8"
  );
  return true;
}

function createFixMessages(
  file: FileFix,
  content: string,
  config: Config
): Message[] {
  const currentContent = fs.readFileSync(file.filePath, "utf8");
  return [
    {
      role: "system",
      content: `You are a senior engineer fixing code issues. Provide ONLY the corrected file content wrapped in <updated-code> tags. Preserve formatting and comments.`,
    },
    {
      role: "user",
      content: [
        `File: ${file.filePath}`,
        `Current content:\n${currentContent}`,
        `Fix:\n${file.fixedCode}`,
      ].join("\n\n"),
    },
  ];
}

function getPrompt(config: Config): string {
  let systemPrompt = config.systemPrompt;

  if (systemPrompt && fs.existsSync(systemPrompt)) {
    systemPrompt = fs.readFileSync(systemPrompt, "utf8");
  } else {
    systemPrompt = DEFAULT_PROMPT;
  }

  if (config.fix) {
    return [systemPrompt, FIX_PROMPT].join("\n");
  }
  return systemPrompt;
}

export async function analyzeTestFailure(
  config: Config,
  testOutput: string,
  repoStructure: string,
  gitDiff: string
): Promise<string> {
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
      content: getPrompt(config),
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
  return streamAIResponse({
    api: apis.DEEPSEEK,
    config,
    messages,
    appendReasoningMessages: true,
  });
}
