import { describe, it, expect, vi, beforeEach } from "vitest";
import { ui } from "../ui.js";
import { render } from "ink";
import { logStore } from "../log-store.js";

// Mock process.stdin.isTTY to true for tests
Object.defineProperty(process.stdin, "isTTY", { value: true });

vi.mock("ink", () => ({
  render: vi.fn(() => ({
    unmount: vi.fn(),
    waitUntilExit: vi.fn(),
    rerender: vi.fn(),
    cleanup: vi.fn(),
    clear: vi.fn(),
  })),
}));

describe("UI Manager", () => {
  let mockUnmount: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.resetAllMocks();
    mockUnmount = vi.fn();
    vi.spyOn(process, "exit").mockImplementation(() => undefined as never);
    const mockRender = render as unknown as ReturnType<typeof vi.fn>;
    mockRender.mockReturnValue({ unmount: mockUnmount });
    ui.destroy();
    logStore.clear();
  });

  it("should initialize UI only once", () => {
    ui.initialize();
    ui.initialize(); // Second call should be ignored
    expect(render).toHaveBeenCalledTimes(1);
  });

  it("should handle output logging correctly", () => {
    const consoleSpy = vi.spyOn(process.stdout, "write");

    // Test without UI initialized
    ui.appendOutputLog("test output");
    expect(consoleSpy).toHaveBeenCalledWith("test output");

    // Initialize UI and test again
    ui.initialize();
    ui.appendOutputLog("ui output");
    expect(logStore.getOutput()).toBe("ui output");
  });

  it("should clean up resources on destroy", () => {
    ui.initialize();
    ui.destroy();
    expect(mockUnmount).toHaveBeenCalled();
  });

  it("should handle SIGINT cleanup", () => {
    ui.initialize();
    process.emit("SIGINT");
    expect(mockUnmount).toHaveBeenCalled();
    expect(process.exit).toHaveBeenCalledWith(0);
  });
});
