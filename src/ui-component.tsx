import React, { useEffect, useState } from "react";
import { Box, Text } from "ink";
import { logStore } from "./log-store.js";

function justifyText(text: string, width: number): string[] {
  if (text.length <= width) {
    return [text];
  }

  const lines = text.split("\n");
  return lines.flatMap((line) => {
    if (line.length <= width) {
      return [line];
    }
    // Find the last space in the first 'width' characters
    const firstChunk = line.slice(0, width);
    const lastSpaceIndex = firstChunk.lastIndexOf(" ");
    let splitIndex: number;
    if (lastSpaceIndex === -1) {
      splitIndex = width; // No space found, split at the width (may break a word)
    } else {
      splitIndex = lastSpaceIndex + 1; // Include the space in the first part
    }
    return [
      line.slice(0, splitIndex),
      ...justifyText(line.slice(splitIndex), width),
    ];
  });
}

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
  const width = process.stdout.columns - 4; // 4 for the border
  const justifiedItems = items.flatMap((item) => justifyText(item, width));
  const visibleLines = justifiedItems.slice(-height - 3);

  return (
    <Box
      borderStyle="round"
      borderColor={borderColor}
      flexDirection="column"
      height={height}
      minHeight={height}
      width="100%"
    >
      <Box height={1} marginTop={-1}>
        <Text backgroundColor={borderColor} bold>
          {` ${title} `}
        </Text>
      </Box>
      <Box flexGrow={1} overflow="hidden" flexDirection="column">
        {visibleLines.map((line, index) => (
          <Text key={index} wrap="wrap">
            {line}
          </Text>
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
  const availableHeight = Math.max(terminalHeight - 1, 6);

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
        borderColor="blue"
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
