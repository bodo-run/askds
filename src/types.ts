export interface CodeFix {
  filePath: string;
  originalContent: string;
  fixedContent: string;
  applied: boolean;
  error?: string;
}

export interface FixResult {
  totalFiles: number;
  filesModified: number;
  errors: number;
  success: boolean;
}
