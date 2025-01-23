/**
 * Represents a code fix operation with original and fixed content
 */
export interface CodeFix {
  /** Path to the file being fixed */
  filePath: string;
  /** Original content of the file before fix */
  originalContent: string;
  /** Fixed content after applying changes */
  fixedContent: string;
  /** Whether the fix was successfully applied */
  applied: boolean;
  /** Optional error message if fix failed */
  error?: string;
}

/**
 * Results of running fixes across multiple files
 */
export interface FixResult {
  /** Total number of files processed */
  totalFiles: number;
  /** Number of files that were modified */
  filesModified: number;
  /** Number of errors encountered */
  errors: number;
  /** Whether the overall fix operation was successful */
  success: boolean;
}

/**
 * Configuration options for the application
 */
export interface Config {
  /** Enable debug logging */
  debug: boolean;
  /** Command to run tests */
  testCommand: string;
  /** Command to serialize test output */
  serializeCommand: string;
  /** API key for external services */
  apiKey: string;
  /** Optional path to system prompt file */
  systemPromptFile?: string;
  /** Whether to hide reasoning in output */
  hideReasoning: boolean;
  /** Glob patterns for test files */
  testFilePattern: string[];
  /** Glob patterns for source files */
  sourceFilePattern: string[];
  /** Operation timeout in milliseconds */
  timeout: number;
  /** Whether to apply fixes */
  fix: boolean;
  /** Whether to run in interactive mode */
  interactive: boolean;
  /** Optional test output capture */
  testOutput?: string;
  /** Optional repository structure information */
  repoStructure?: string;
}

/**
 * Represents a message in a conversation
 */
export interface Message {
  /** Role of the message sender */
  role: "system" | "user" | "assistant";
  /** Content of the message */
  content: string;
}
