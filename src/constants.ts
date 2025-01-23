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

export const MAX_FILES_TO_FIX = 50;
