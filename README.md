# `askds` - DeepSeek R1-powered test debugger

`askds` is a test debugger that helps diagnose test failures using DeepSeek R1. It runs your tests, analyzes failures, and suggests fixes.

[Screencast](https://github.com/user-attachments/assets/477e92e2-6701-4138-8ffb-c910ef61571e)

## Installation

Make sure you have [`yek`](https://github.com/bodo-run/yek) installed:

```bash
npm install -g askds
```

## Basic Usage

Run tests with AI analysis:

```bash
export DEEPSEEK_API_KEY="your-api-key"
askds npm test
```

## Configuration

Set these environment variables to customize behavior:

| Variable           | Description      | Default |
| ------------------ | ---------------- | ------- |
| `DEEPSEEK_API_KEY` | Required API key | -       |

Command line options:

| Flag                    | Description                   | Default        |
| ----------------------- | ----------------------------- | -------------- |
| `--test-file-pattern`   | Glob pattern for test files   | `**/*.test.ts` |
| `--source-file-pattern` | Glob pattern for source files | `src/**/*.ts`  |
| `--serialize`           | Repository serialization cmd  | `yek`          |
| `--debug`               | Enable debug mode             | `false`        |
| `--hide-reasoning`      | Hide AI reasoning             | `false`        |
| `--system-prompt`       | Custom system prompt file     | -              |

## How It Works

1. Runs your test command
2. Analyzes failures + repo content using Deepseek R1
3. Prints the solution/suggestion

## Examples

### Basic Test Analysis

```bash
askai npm test
```

## Experimental Fixing

```bash
askds --fix npm test
```

You will need to have a Fireworks AI API key set under `FIREWORKS_API_KEY`.
