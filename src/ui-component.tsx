import React, { useEffect, useState } from "react";
import { Box, Text } from "ink";
import { logStore } from "./log-store.js";

/**
 * A scrollable box that shows the last `height - 2` lines of content,
 * ensuring newer lines remain visible at the bottom.
 */
const ScrollableBox: React.FC<{
  title: string;
  items: string[];
  borderColor: string;
  height: number;
}> = ({ title, items, borderColor, height }) => {
  // Reserve space for the top line (title) and one line at the bottom/border
  const contentHeight = Math.max(height - 2, 0);
  // Show only the last `contentHeight` lines
  const visibleLines = items.slice(-contentHeight);

  return (
    <Box
      borderStyle="round"
      borderColor={borderColor}
      flexDirection="column"
      height={height}
      minHeight={height}
      width="100%"
    >
      <Box height={1}>
        <Text bold>{title}</Text>
      </Box>
      <Box flexGrow={1} overflow="hidden" flexDirection="column">
        {visibleLines.map((line, index) => (
          <Text key={index}>{line}</Text>
        ))}
      </Box>
    </Box>
  );
};

export const TerminalUI = () => {
  const [output, setOutput] = useState("");
  const [reasoning, setReasoning] = useState("");

  // Terminal rows
  const terminalHeight = process.stdout.rows;

  // Some space for padding / instructions line:
  const availableHeight = Math.max(terminalHeight - 4, 6);

  // Split the available space for the two boxes
  const halfHeight = Math.floor(availableHeight / 2);
  const testResultsHeight = Math.max(halfHeight, 3);
  const reasoningHeight = availableHeight - testResultsHeight;

  useEffect(() => {
    const unsubscribe = logStore.subscribe(() => {
      setOutput(logStore.getOutput());
      setReasoning(logStore.getReasoning());
    });
    return unsubscribe;
  }, []);

  return (
    <Box flexDirection="column" padding={1} height={terminalHeight}>
      <ScrollableBox
        title="Test Results"
        items={output.split("\n")}
        borderColor="cyan"
        height={testResultsHeight}
      />
      <ScrollableBox
        title="Reasoning"
        items={reasoning.split("\n")}
        borderColor="green"
        height={reasoningHeight}
      />
      <Box height={1}>
        <Text color="gray" italic>
          Press q to exit • Ctrl+C to abort
        </Text>
      </Box>
    </Box>
  );
};
