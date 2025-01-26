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
  DEFAULT_FIX_PROMPT,
  FILE_PATH_TAG,
  FIX_END_TAG,
  FIX_START_TAG,
  UPDATED_CODE_END_TAG,
  UPDATED_CODE_START_TAG,
  FIX_FILE_FORMAT_INSTRUCTION,
  APPLY_CHANGES_INSTRUCTION,
  ORIGINAL_FILE_START_TAG,
  ORIGINAL_FILE_END_TAG,
} from "./constants.js";
import { Config, Message } from "./types.js";
import { ui } from "./ui.js";

export function extractFixedCode(aiResponse: string): string | null {
  const start = aiResponse.indexOf(UPDATED_CODE_START_TAG);
  const end = aiResponse.indexOf(UPDATED_CODE_END_TAG);

  if (start === -1 || end === -1) return null;

  return aiResponse.slice(start + UPDATED_CODE_START_TAG.length, end).trim();
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
): Promise<boolean[]> {
  const filesToFix = await identifyFixableFiles(options.analysis);

  ui.appendOutputLog(`Fixing ${filesToFix.length} files...\n`);

  const results = await Promise.all(
    filesToFix.map((file) => processFileFix(file, config, options))
  );

  return results;
}
type FileFix = {
  filePath: string;
  fixedCode: string;
  isComplete: boolean;
};

export async function identifyFixableFiles(
  analysis?: string
): Promise<FileFix[]> {
  const files =
    analysis
      ?.split("\n")
      .flatMap((line) => {
        // Handle cases where FIX_END_TAG and FILE_PATH_TAG are on same line
        if (line.includes(FIX_END_TAG) && line.includes(FILE_PATH_TAG)) {
          return line.replace(FIX_END_TAG, FIX_END_TAG + "\n").split("\n");
        }
        return [line];
      })
      .map((line) => line.trim())
      .reduce((acc, line) => {
        const last = acc.at(-1);
        const isFilePath = line.startsWith(FILE_PATH_TAG);
        const isFixStart = line.startsWith(FIX_START_TAG);
        const isFixEnd = line.startsWith(FIX_END_TAG);

        if (isFilePath) {
          let filePath = line.slice(FILE_PATH_TAG.length);
          // remove leading slash, no absolute paths
          if (filePath.startsWith("/")) {
            filePath = filePath.slice(1);
          }
          acc.push({
            filePath,
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
  if (!fs.existsSync(fullPath)) {
    ui.appendOutputLog(`${file.filePath} does not exist. Creating it...\n`);
    fs.writeFileSync(fullPath, "", "utf8");
  }
  const originalContent = await fs.promises.readFile(fullPath, "utf8");

  const messages = createFixMessages(file, originalContent, config);
  ui.appendOutputLog(
    chalk.bold(
      `Asking ${apis.DEEPSEEK.provider}(${apis.DEEPSEEK.model}) to fix ${file.filePath}...\n`
    )
  );

  const aiResponse = await streamAIResponse({
    api: apis.DEEPSEEK,
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

  ui.appendOutputLog(`Writing fixed content to ${file.filePath}...\n`);

  // always add a new line at the end of the file if it doesn't already have one
  fs.writeFileSync(
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
        `${FILE_PATH_TAG}${file.filePath}`,
        `${ORIGINAL_FILE_START_TAG}`,
        currentContent,
        `${ORIGINAL_FILE_END_TAG}`,
        file.fixedCode, // this should include the FIX_START_TAG and FIX_END_TAG
        `${APPLY_CHANGES_INSTRUCTION}`,
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
    return [
      systemPrompt,
      config.fixPrompt || DEFAULT_FIX_PROMPT,
      FIX_FILE_FORMAT_INSTRUCTION,
    ].join("\n");
  }
  return systemPrompt;
}

export async function analyzeTestFailure(
  config: Config,
  testOutput: string,
  repoStructure: string,
  gitDiff: string
): Promise<string> {
  const testFiles = await findTestFiles(testOutput, config);

  if (testFiles.length === 0) {
    ui.appendOutputLog(
      `\n{WARN} No test files found matching failure ${config.testFilePattern}\n`
    );
    ui.appendOutputLog(
      "You can specify test file patterns with --test-file-pattern\n"
    );
    ui.appendOutputLog(
      "Moving forward without having any test files anyways...\n"
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

  ui.appendReasoningLog(
    chalk.bold(
      `Analyzing test failures using ${apis.DEEPSEEK.provider}(${apis.DEEPSEEK.model})...\n`
    )
  );
  return streamAIResponse({
    api: apis.DEEPSEEK,
    config,
    messages,
    appendReasoningMessages: true,
  });
}
