export const FILE_PATH_TAG = "<<<FILE_PATH>>>";
export const FIX_START_TAG = "<<<FIX_START>>>";
export const FIX_END_TAG = "<<<FIX_END>>>";
export const ORIGINAL_FILE_START_TAG = "<<<ORIGINAL_FILE_START>>>";
export const ORIGINAL_FILE_END_TAG = "<<<ORIGINAL_FILE_END>>>";
export const DEFAULT_PROMPT = [
  "You are a senior software engineer helping debug test failures. Analyze:",
  "1. Test output",
  "2. Repository structure",
  "3. Code changes (git diff)",
  "4. Relevant test files",
  "Provide concise, actionable solutions. When providing code fixes, only provide the code that needs to be changed, not the entire file.",
  "Make sure all files are identified correctly.",
].join("\n");

export const DEFAULT_FIX_PROMPT = [
  "Suggest only one solution and not multiple solutions.",
].join("\n");

export const FIX_FILE_FORMAT_INSTRUCTION = [
  `Start the output with two empty lines.`,
  `Output fixes in this format:\n\n`,
  `${FILE_PATH_TAG}<file_path>\n${FIX_START_TAG}\n<fixed_code>\n${FIX_END_TAG}\n\n\n`,
  `Make sure file paths are correct and never absolute paths.`,
].join("\n");

export const APPLY_CHANGES_INSTRUCTION = [
  "Instructions:",
  "Apply the following steps to update the original file based on the provided patch:",
  `1. Locate the file at the given file path: ${FILE_PATH_TAG} and its content between ${ORIGINAL_FILE_START_TAG} and ${ORIGINAL_FILE_END_TAG} tags.`,
  `2. Identify the exact sections of the file that need modification as specified by the patch under the ${FIX_START_TAG} and ${FIX_END_TAG} tags.`,
  `3. Replace only the affected sections of the file with the new content provided between the ${FIX_START_TAG} and ${FIX_END_TAG} tags.`,
  `4. Retain all other parts of the file unchanged, ensuring no modifications are made to unaffected code or formatting.`,
  "5. Return the updated file content in its entirety without adding any extra text, comments, or explanations.",
  "6. Do not return Markdown or any other formatting. DO NOT WRAP THE OUTPUT IN CODE TAGS.",
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

export const UPDATED_CODE_START_TAG = "<updated-code>";
export const UPDATED_CODE_END_TAG = "</updated-code>";
