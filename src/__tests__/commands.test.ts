import { describe, it, expect, vi, beforeEach } from "vitest";
import { executeCommand, findTestFiles } from "../commands.js";
import { Config } from "../types.js";
import { ui } from "../ui.js";

const mockSync = vi.hoisted(() => vi.fn());

vi.mock("fast-glob", () => ({
  default: { sync: mockSync },
}));

describe("Command Utilities", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    ui.destroy();
    mockSync.mockReset();
  });

  describe("executeCommand", () => {
    it("should resolve with command output", async () => {
      const mockSpawn = vi.fn(() => ({
        stdout: { on: vi.fn() },
        stderr: { on: vi.fn() },
        on: vi.fn((event, cb) => cb(0)),
      }));
      vi.stubGlobal("child_process", { spawn: mockSpawn });
      const result = await executeCommand("echo", ["test"]);
      expect(result).toContain("test");
    });

    it("should reject on non-zero exit code", async () => {
      const mockSpawn = vi.fn(() => ({
        stdout: { on: vi.fn() },
        stderr: { on: vi.fn() },
        on: vi.fn((event, cb) => cb(1)),
      }));
      vi.stubGlobal("child_process", { spawn: mockSpawn });
      await expect(executeCommand("false", [])).rejects.toThrow();
    });

    it("should call onData callback with output", async () => {
      const onData = vi.fn();
      const mockSpawn = vi.fn(() => ({
        stdout: { on: vi.fn((event, cb) => cb(Buffer.from("test"))) },
        stderr: { on: vi.fn() },
        on: vi.fn((event, cb) => cb(0)),
      }));
      vi.stubGlobal("child_process", { spawn: mockSpawn });
      await executeCommand("echo", ["test"], { onData } as any);
      expect(onData).toHaveBeenCalledWith(expect.stringContaining("test"));
    });
  });

  describe("findTestFiles", () => {
    const mockConfig: Config = { testFilePattern: ["**/*.test.ts"] } as Config;

    it("should find test files in output", () => {
      const testOutput = ["FAIL src/test.test.ts", "PASS src/other.ts"].join(
        "\n"
      );
      mockSync.mockReturnValue(["src/test.test.ts"]);
      const result = findTestFiles(testOutput, mockConfig);
      expect(result).toEqual(["src/test.test.ts"]);
      expect(mockSync).toHaveBeenCalledWith(
        mockConfig.testFilePattern,
        expect.any(Object)
      );
    });
  });
});
