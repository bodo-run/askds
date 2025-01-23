import blessed from "blessed";
import { createPatch, ParsedDiff } from "diff";
import fastGlob from "fast-glob";
import fs from "node:fs";
import path from "node:path";

import { parsePatch } from "diff";
import { streamAIResponse, apis } from "./api";
import { findTestFiles } from "./commands";
import { DEFAULT_PROMPT, MAX_FILES_TO_FIX } from "./constants";
import { Config, Message } from "./types";
import { ui } from "./ui";

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
): Promise<boolean> {
  console.log(`\nChanges for ${filePath}:`);
  console.log(highlightChanges(original, fixed));
  const answer = await new Promise<string>((resolve) => {
    const prompt = blessed.prompt({
      text: "Apply these changes? (y/N)",
      onSubmit: (value: string) => resolve(value || "n"),
    });
    prompt.focus();
  });

  return answer.toLowerCase() === "y";
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
  options: { interactive?: boolean }
): Promise<boolean> {
  const filesToFix = await identifyFixableFiles(config);

  let success = true;
  for (const file of filesToFix) {
    const fixResult = await processFileFix(file, config, options);
    if (!fixResult) success = false;
  }

  return success;
}

async function identifyFixableFiles(config: Config): Promise<string[]> {
  return fastGlob(["**/*.{ts,js,py,java}"], {
    cwd: process.cwd(),
    ignore: config.sourceFilePattern,
    absolute: false,
    onlyFiles: true,
  }).then((files) => files.slice(0, MAX_FILES_TO_FIX));
}

async function processFileFix(
  filePath: string,
  config: Config,
  options: { interactive?: boolean }
) {
  const fullPath = path.join(process.cwd(), filePath);
  const originalContent = await fs.promises.readFile(fullPath, "utf8");

  const messages = createFixMessages(filePath, originalContent, config);
  const aiResponse = await streamAIResponse({
    api: apis.FIREWORKS,
    config,
    messages,
  });
  const fixedContent = extractFixedCode(aiResponse);

  if (!fixedContent || fixedContent === originalContent) {
    return false;
  }

  if (options.interactive) {
    const confirmed = await promptConfirmation(
      filePath,
      originalContent,
      fixedContent
    );
    if (!confirmed) return false;
  }

  await fs.promises.writeFile(fullPath, fixedContent, "utf8");
  return true;
}

function createFixMessages(
  filePath: string,
  content: string,
  config: Config
): Message[] {
  return [
    {
      role: "system",
      content: `You are a senior engineer fixing code issues. Provide ONLY the corrected file content wrapped in <updated-code> tags. Preserve formatting and comments.`,
    },
    {
      role: "user",
      content: [
        `File: ${filePath}`,
        `Current content:\n${content}`,
        `Test failures:\n${config.testOutput}`,
        `Repository context:\n${config.repoStructure}`,
      ].join("\n\n"),
    },
  ];
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
      content: config.systemPrompt
        ? fs.existsSync(config.systemPrompt)
          ? fs.readFileSync(config.systemPrompt, "utf8")
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
  return streamAIResponse({
    api: apis.DEEPSEEK,
    config,
    messages,
    appendReasoningMessages: true,
  });
}
