# Examples

This directory contains example implementations demonstrating how to use Contextor.

## Examples

### 1. Hono Server (`hono-server.ts`)

A simple Hono server that exposes an AI SDK-compatible streaming endpoint for the code agent.

**Run:**

```bash
bun run server
```

**Test:**

```bash
bun run test:client
```

### 2. Code Agent (`agents/code-agent.ts`)

A basic agent with file manipulation tools for writing scripts.

### 3. Long-Running Agent (`agents/long-running-agent.ts`)

Demonstrates context management for agents with many steps (30-50+), using the context manager processor.

**Run:**

```bash
bun run test:context
```

### 4. Prepare Step Example (`agents/prepare-step-example.ts`)

Shows how to use `prepareStep` with the new MastraDBMessage format.

**Run:**

```bash
bun run test:prepare
```

## Setup

1. Copy `.env.example` to `.env` and add your `ANTHROPIC_API_KEY`
2. Install dependencies: `bun install`
3. Run any example script

## Tools

All examples use bash tools (`tools/bash-tools.ts`) for file operations:

- `writeFile` - Write files to temp directory
- `readFile` - Read files from temp directory or any path
- `listFiles` - List files in directories
- `executeBash` - Execute bash commands
