# `askds` - DeepSeek R1-powered test debugger

`askds` is a test debugger that helps diagnose test failures using DeepSeek R1. It runs your tests and provides the results to an AI agent to analyze and suggest solutions.

For repo serialization, it uses [`yek`](https://github.com/bodo-run/yek) to serialize the repository.



[Screencast](https://github.com/user-attachments/assets/477e92e2-6701-4138-8ffb-c910ef61571e)



## Installation

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

## Examples

```bash
askds --serialize="yek src/" npm test
```

### Writing your own prompts

```bash
askds --system-prompt="./prompts/fix-test.txt" cargo test
```

### Hide reasoning

```bash
askds --hide-reasoning cargo test
```

### Debug mode

```bash
askds --debug npm test
```
