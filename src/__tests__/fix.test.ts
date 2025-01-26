import { describe, it, expect, vi, beforeEach } from "vitest";
import { extractFixedCode, identifyFixableFiles } from "../fix.js";
import { FILE_PATH_TAG, FIX_END_TAG, FIX_START_TAG } from "../constants.js";

describe("Fix Utilities", () => {
  describe("extractFixedCode", () => {
    it("should return null when tags are missing", () => {
      expect(extractFixedCode("no tags here")).toBeNull();
    });

    it("should extract content between tags", () => {
      const content = `prefix\n<updated-code>\nconst a = 1;\n</updated-code>\nsuffix`;
      expect(extractFixedCode(content)).toBe("const a = 1;");
    });
  });
});
