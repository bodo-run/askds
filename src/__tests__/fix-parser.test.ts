import { describe, expect, it } from "vitest";
import { FILE_PATH_TAG, FIX_END_TAG, FIX_START_TAG } from "../constants.js";
import { identifyFixableFiles } from "../fix.js";

describe("Fix Parser", () => {
  it("should handle concatenated FIX_END and FILE_PATH tags", async () => {
    const analysis = [
      `${FILE_PATH_TAG}tests/test1.rs`,
      FIX_START_TAG,
      `let code1 = "test";`,
      `${FIX_END_TAG}${FILE_PATH_TAG}tests/test2.rs`,
      FIX_START_TAG,
      `let code2 = "test";`,
      FIX_END_TAG,
    ].join("\n");

    const result = await identifyFixableFiles(analysis);

    expect(result).toHaveLength(2);
    expect(result).toEqual([
      {
        filePath: "tests/test1.rs",
        fixedCode: `let code1 = "test";`,
        isComplete: true,
      },
      {
        filePath: "tests/test2.rs",
        fixedCode: `let code2 = "test";`,
        isComplete: true,
      },
    ]);
  });
});
