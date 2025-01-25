import React from "react";
import { Box, render } from "ink";
import { TerminalUI } from "./ui-component.js";
import { logStore } from "./log-store.js";

let isInitialized = false;
let unmount: () => void;

export const ui = {
  initialize() {
    if (isInitialized || !process.stdin.isTTY) return;

    isInitialized = true;
    const { unmount: u } = render(<TerminalUI />, {
      exitOnCtrlC: true,
      patchConsole: false,
    });
    unmount = u;

    process.stdin.on("keypress", (ch, key) => {
      if (key?.name === "q") {
        this.destroy();
        process.exit(0);
      }
    });

    process.on("SIGINT", () => {
      this.destroy();
      process.exit(0);
    });
  },

  appendOutputLog(text: string) {
    if (isInitialized) {
      logStore.appendOutput(text);
    } else {
      process.stdout.write(text);
    }
  },

  appendReasoningLog(text: string) {
    if (isInitialized) {
      logStore.appendReasoning(text);
    } else {
      process.stdout.write(text);
    }
  },

  destroy() {
    if (isInitialized && unmount) {
      unmount();
      logStore.clear();
      isInitialized = false;
    }
  },
};
