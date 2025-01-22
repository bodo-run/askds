# `askai` - AI-powered test debugger

AI-powered test debugger that helps diagnose test failures using AI. It runs your tests and provides the results to an AI agent to analyze and suggest solutions.

For repo serialization, it uses [`yek`](https://github.com/bodo-run/yek) to serialize the repository.

## Installation

```bash
npm install -g askai
```

## Usage

Basic usage:

```bash
export DEEPSEEK_API_KEY="your-api-key"
askai npm test
```

With debug mode:

```bash
askai --debug npm test
```

## Configuration

Set these environment variables to customize behavior:

| Variable           | Description      | Default |
| ------------------ | ---------------- | ------- |
| `DEEPSEEK_API_KEY` | Required API key | -       |

## Examples

### For JavaScript/Node.js

```bash
askai --serialize="yek --exclude 'node_modules'" npm test
```
