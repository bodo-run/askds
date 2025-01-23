import blessed from "blessed";
import contrib from "blessed-contrib";

export interface BlessedUI {
  initialize: () => void;
  appendOutputLog: (text: string) => void;
  appendReasoningLog: (text: string) => void;
  render: () => void;
  destroy: () => void;
}

const filterCursorCodes = (text: string) => text.replace(/\x1B\[\?25[hl]/g, "");

export function createBlessedUI(): BlessedUI {
  let initialized = false;
  let screen: blessed.Widgets.Screen | undefined;
  let grid: contrib.grid | undefined;
  let outputLog: contrib.Widgets.LogElement | undefined;
  let reasoningLog: contrib.Widgets.LogElement | undefined;

  function initialize() {
    if (initialized) return;

    // Check if we're in a TTY environment
    if (!process.stdin.isTTY || !process.stdout.isTTY) {
      return;
    }

    try {
      initialized = true;
      screen = blessed.screen({
        smartCSR: true,
        title: "DeepSeek Test Analyzer",
        fullUnicode: true,
        terminal: "xterm-256color",
      });

      grid = new contrib.grid({
        rows: 2,
        cols: 1,
        screen,
      });

      outputLog = grid.set(0, 0, 1, 1, contrib.log, {
        label: " Test Results ",
        bufferLength: 1000,
        scrollable: true,
        input: true,
        mouse: true,
        keys: true,
        ansi: true,
        scrollbar: true,
        style: {
          fg: "inherit",
          bg: "inherit",
          border: { fg: "cyan" },
        },
      });

      reasoningLog = grid.set(1, 0, 1, 1, contrib.log, {
        label: " Reasoning ",
        bufferLength: 1000,
        scrollable: true,
        input: true,
        mouse: true,
        keys: true,
        ansi: true,
        scrollbar: true,
        style: {
          text: "gray",
          bg: "inherit",
          fg: "inherit",
          border: { fg: "green" },
        },
      });

      screen.key(["escape", "q", "C-c"], () => {
        destroy();
        process.exit(0);
      });
    } catch (error) {
      initialized = false;
      console.error("Failed to initialize UI:", error);
    }
  }

  function appendOutputLog(text: string) {
    try {
      if (!initialized || !outputLog) {
        console.log("[OUTPUT]", text);
        return;
      }
      outputLog.setContent(outputLog.getContent() + filterCursorCodes(text));
      outputLog.scrollTo(outputLog.getScrollHeight());
      render();
    } catch (e) {
      console.error("UI Error:", e);
      console.log("[OUTPUT]", text);
    }
  }

  function appendReasoningLog(text: string) {
    try {
      if (!initialized || !reasoningLog) {
        console.log("[REASONING]", text);
        return;
      }
      reasoningLog.setContent(
        reasoningLog.getContent() + filterCursorCodes(text)
      );
      reasoningLog.scrollTo(reasoningLog.getScrollHeight());
      render();
    } catch (e) {
      console.error("UI Error:", e);
      console.log("[REASONING]", text);
    }
  }

  function render() {
    if (!initialized || !screen) {
      return;
    }
    screen.render();
  }

  function destroy() {
    if (initialized && screen) {
      try {
        screen.destroy();
        process.stdout.write("\x1B[0m\x1Bc"); // Clear screen
      } catch (error) {
        console.error("Error cleaning up UI:", error);
      }
      initialized = false;
    }
  }

  return {
    initialize,
    appendOutputLog,
    appendReasoningLog,
    render,
    destroy,
  };
}

export const ui = createBlessedUI();
