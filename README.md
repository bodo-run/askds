# `askds` - DeepSeek R1-powered test debugger

`askds` is a test debugger that helps diagnose test failures using DeepSeek R1. It runs your tests, analyzes failures, and can automatically apply fixes using [`fast-apply`](https://github.com/kortix-ai/fast-apply).

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

Run tests and automatically apply fixes:

```bash
export FIREWORKS_AI_API_KEY="your-api-key"
askds --fix npm test
```

## Fix Options

- `--fix`: Enable automatic fixing. You will need a Fireworks AI API key.
- `--interactive`: Confirm each change before applying, only works with `--fix`

Example workflow:

```bash
# Run tests and apply fixes interactively
askds --fix --interactive npm test

# See proposed changes without modifying files
askds --fix npm test
```

## Configuration

Set these environment variables to customize behavior:

| Variable               | Description                         | Default |
| ---------------------- | ----------------------------------- | ------- |
| `DEEPSEEK_API_KEY`     | Required API key                    | -       |
| `FIREWORKS_AI_API_KEY` | Required API key for applying fixes | -       |

Command line options:

| Flag                    | Description                   | Default        |
| ----------------------- | ----------------------------- | -------------- |
| `--test-file-pattern`   | Glob pattern for test files   | `**/*.test.ts` |
| `--source-file-pattern` | Glob pattern for source files | `src/**/*.ts`  |
| `--serialize`           | Repository serialization cmd  | `yek`          |
| `--debug`               | Enable debug mode             | `false`        |
| `--hide-reasoning`      | Hide AI reasoning             | `false`        |
| `--system-prompt`       | Custom system prompt file     | -              |
| `--fix`                 | Enable automatic fixing       | `false`        |
| `--interactive`         | Confirm each fix              | `false`        |

## How It Works

1. Runs your test command
2. Analyzes failures using Fireworks AI
3. Generates targeted fixes while preserving code structure
4. Applies changes safely with user confirmation (if `--fix` is enabled)

## Examples

### Basic Test Analysis

```bash
askai npm test
```

### Interactive Fixing

```bash
askai --fix --interactive npm test
```

### Custom Test Command

```bash
askai --fix cargo test --features special
```
