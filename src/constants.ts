import { Config } from "./types";

export const DEFAULT_PROMPT = [
  "You are a senior software engineer helping debug test failures. Analyze:",
  "1. Test output",
  "2. Repository structure",
  "3. Code changes (git diff)",
  "4. Relevant test files",
  "Provide concise, actionable solutions.",
].join("\n");

export const DEFAULT_TEST_FILE_PATTERN = [
  "**/*.{test,spec}.*",
  "**/*.{tests,specs}.*",
  "**/__tests__/**/*",
  "**/__test__/**/*",
  "**/test/**/*",
  "**/tests/**/*",
];

export const DEFAULT_CONFIG: Omit<Config, "apiKey" | "testCommand"> = {
  debug: false,
  serializeCommand: "yek",
  systemPromptFile: "",
  hideReasoning: false,
  testFilePattern: DEFAULT_TEST_FILE_PATTERN,
  sourceFilePattern: DEFAULT_TEST_FILE_PATTERN.map((pattern) => `!${pattern}`),
  timeout: 2 * 60 * 1000, // 2 minutes
  fix: false,
  interactive: false,
};
