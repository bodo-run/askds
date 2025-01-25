export const FILE_PATH_TAG = "<<<FILE_PATH>>>";
export const FIX_START_TAG = "<<<FIX_START>>>";
export const FIX_END_TAG = "<<<FIX_END>>>";
export const DEFAULT_PROMPT = [
  "You are a senior software engineer helping debug test failures. Analyze:",
  "1. Test output",
  "2. Repository structure",
  "3. Code changes (git diff)",
  "4. Relevant test files",
  "Provide concise, actionable solutions. When providing code fixes, only provide the code that needs to be changed, not the entire file.",
  "Make sure all files are identified correctly.",
].join("\n");

export const FIX_PROMPT = [
  "Suggest only one solution and not multiple solutions.",
  `Output fixes in this format: ${FILE_PATH_TAG}<file_path>\n${FIX_START_TAG}\n<fixed_code>\n${FIX_END_TAG}\n\n\n`,
  `Make sure file paths are correct and never absolute paths.`,
].join("\n");

export const DEFAULT_TEST_FILE_PATTERN = [
  "**/*.{test,spec}.*",
  "**/*.{tests,specs}.*",
  "**/__tests__/**/*",
  "**/__test__/**/*",
  "**/test/**/*",
  "**/tests/**/*",
];

export const MAX_FILES_TO_FIX = 1; // for testing
