# `askds` - DeepSeek R1-powered test debugger

`askds` is a test debugger that helps diagnose test failures using DeepSeek R1. It runs your tests and provides the results to an AI agent to analyze and suggest solutions.

For repository serialization, it uses [`yek`](https://github.com/bodo-run/yek) to serialize the repository.

[Screencast](https://github.com/user-attachments/assets/477e92e2-6701-4138-8ffb-c910ef61571e)

## Installation

Make sure you have [`yek`](https://github.com/bodo-run/yek) installed:

```bash
curl -fsSL https://bodo.run/yek.sh | bash
```

Then install `askds`:

```bash
npm install -g askds
```

## Usage

Basic usage:

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

## Examples

### Serialization

See [`yek`](https://github.com/bodo-run/yek) for more information on serialization. You can run any command that outputs a string to the console using `--serialize`.

```bash
askds --serialize="yek src/" npm test
```

### Asking Questions

Since we run the command you provide to get test results, you can execute any arbitrary command to feed input to the AI agent.

```bash
askds --serialize="yek src/" echo "Review my changes"
```

### Writing Custom Prompts

```bash
askds --system-prompt="./prompts/fix-test.txt" cargo test
```

### Hide Reasoning

```bash
askds --hide-reasoning cargo test
```

### Debug Mode

```bash
askds --debug npm test
```
