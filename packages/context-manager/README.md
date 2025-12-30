# Contextor - Context Management Orchestrator

**Orchestration-only context management** - decides WHEN strategies run, not HOW. You implement the strategies.

## Framework Integration

Contextor works with any agent framework. For example, **Mastra** provides:

- ✅ **`TokenLimiterProcessor`** - Filters messages to fit within a token limit, prioritizing recent messages
- ✅ **`Memory.lastMessages`** - Limits how many messages are retrieved from storage (retrieval-time, not execution-time)
- ❌ **No summarization** - You need to implement this yourself
- ❌ **No compaction** - You need to implement this yourself
- ❌ **No offloading** - You need to implement this yourself
- ❌ **No step-based triggers** - You need to implement this yourself
- ❌ **No multi-strategy orchestration** - You need to implement this yourself

**Contextor fills the gap** by providing:

- Step-based triggers (e.g., summarize every 20 steps)
- Token threshold-based triggers (e.g., offload at 60k tokens)
- Multi-strategy orchestration (filter → compact → summarize → offload)
- Lifecycle hooks for custom control

**You still implement the strategies** - we just orchestrate when they run.

## Philosophy

This is an **orchestrator**, not an implementation. It:

- ✅ Decides **when** to trigger strategies based on thresholds and step counts
- ✅ Provides hooks for custom control
- ✅ Works with Mastra's built-in processors (like `TokenLimiterProcessor`)
- ❌ Does **NOT** handle file I/O, storage, or message manipulation directly

## Quick Start

```typescript
import { createContextManager } from '@contextor-ai/core';
import { TokenLimiterProcessor } from '@mastra/core/processors'; // Example: Mastra's processor
import { Agent } from '@mastra/core/agent'; // Example: Mastra agent

// Use framework's built-in token limiter (e.g., Mastra's TokenLimiterProcessor)
const { processor } = createContextManager({
    handlers: {
        filter: async args => {
            const limiter = new TokenLimiterProcessor(40000);
            return await limiter.processInput(args);
        },
    },
});

const agent = new Agent({
    id: 'my-agent',
    inputProcessors: [processor],
});
```

## Key Concepts

### Orchestration vs Implementation

**Orchestration** (this package):

- When to filter (threshold: 40k tokens)
- When to compact (threshold: 50k tokens, min steps: 10)
- When to summarize (every 20 steps, threshold: 70k tokens)
- When to offload (threshold: 60k tokens, min steps: 5)

**Implementation** (your handlers):

- How to filter (use `TokenLimiterProcessor`, custom logic, etc.)
- How to compact (save to S3, database, files, etc.)
- How to summarize (call LLM, use service, etc.)
- How to offload (save to storage, replace with references, etc.)

## Configuration

### Basic: Using Mastra's TokenLimiter

```typescript
import { TokenLimiterProcessor } from '@mastra/core/processors';

const { processor } = createContextManager({
    handlers: {
        filter: async args => {
            const limiter = new TokenLimiterProcessor(40000);
            return await limiter.processInput(args);
        },
    },
});
```

### Custom Offloading Handler

```typescript
const { processor } = createContextManager({
    handlers: {
        offload: async ({ messagesToOffload, messagesToKeep, stepNumber }) => {
            // Your storage logic here
            await saveToDatabase(`offload-${stepNumber}`, messagesToOffload);

            // Return modified messages with reference
            return [
                ...messagesToKeep,
                {
                    id: `offload-ref-${stepNumber}`,
                    role: 'system',
                    content: stringToContentV2(`[Offloaded ${messagesToOffload.length} messages]`),
                    createdAt: new Date(),
                },
            ];
        },
    },
});
```

### Custom Summarization Handler

```typescript
const { processor } = createContextManager({
    handlers: {
        summarize: async ({ oldMessages, recentMessages, stepNumber }) => {
            // Call your LLM/summarization service
            const summary = await summarizeMessages(oldMessages);

            return [
                {
                    id: `summary-${stepNumber}`,
                    role: 'system',
                    content: stringToContentV2(summary),
                    createdAt: new Date(),
                },
                ...recentMessages,
            ];
        },
    },
});
```

## Lifecycle Hooks

### Control When Strategies Run

```typescript
const { processor } = createContextManager({
    handlers: {
        /* ... */
    },
    hooks: {
        // Skip all processing for first 5 steps
        beforeProcess: async args => args.stepNumber >= 5,

        // Custom logic for each strategy
        shouldRunStrategy: async (strategy, args, tokens) => {
            if (strategy === 'offload' && args.stepNumber < 10) {
                return false; // Don't offload until step 10
            }
            return true;
        },

        // Post-processing hook
        afterModify: async (args, messages, strategy) => {
            console.log(`Applied ${strategy} at step ${args.stepNumber}`);
            return messages;
        },
    },
});
```

## Using Presets

```typescript
import { balancedPreset, aggressivePreset } from './context-manager/presets';

// Balanced (default)
const { processor } = createContextManager({
    ...balancedPreset,
    handlers: {
        /* your handlers */
    },
});

// Aggressive (for small context windows)
const { processor } = createContextManager({
    ...aggressivePreset,
    handlers: {
        /* your handlers */
    },
});
```

## Production-Ready Example

```typescript
import { createContextManager } from './context-manager';
import { TokenLimiterProcessor } from '@mastra/core/processors';
import { Agent } from '@mastra/core/agent';
import { Tiktoken } from 'js-tiktoken/lite';
import o200k_base from 'js-tiktoken/ranks/o200k_base';
import { stringToContentV2 } from './context-manager/utils';
// import { logger, metrics } from './your-observability';

// Create tiktoken encoder for accurate token counting
const encoder = new Tiktoken(o200k_base);

const { processor } = createContextManager({
    // Accurate token counting for production
    tokenCounter: async (messages, model) => {
        let totalTokens = 0;
        for (const msg of messages) {
            const text =
                typeof msg.content === 'string' ? msg.content : JSON.stringify(msg.content);
            totalTokens += encoder.encode(text).length;
        }
        return totalTokens;
    },
    thresholds: {
        filter: 40000,
        compact: 50000,
        summarize: 70000,
        offload: 60000,
    },
    handlers: {
        // Use Mastra's built-in processor
        filter: async args => {
            const limiter = new TokenLimiterProcessor(40000);
            return await limiter.processInput(args);
        },
        // ... other handlers
    },
    hooks: {
        // Observability hooks (you implement)
        onError: async (error, strategy, args) => {
            // logger.error('Handler error', { strategy, error, stepNumber: args.stepNumber });
            // metrics.increment('context_manager.error', { strategy });
            console.error(`[Context Manager] ${strategy} failed:`, error);
            return true; // Continue with original messages
        },
        onValidationError: async (strategy, args, reason) => {
            // logger.warn('Validation error', { strategy, reason, stepNumber: args.stepNumber });
            // metrics.increment('context_manager.validation_error', { strategy });
            console.warn(`[Context Manager] ${strategy} validation failed:`, reason);
            return true; // Continue with original messages
        },
        afterModify: async (args, messages, strategy) => {
            // metrics.increment('context_manager.strategy', { strategy });
            // metrics.gauge('context_manager.message_count', messages.length);
            console.log(`[Context Manager] Applied ${strategy} at step ${args.stepNumber}`);
            return messages;
        },
    },
});

const agent = new Agent({
    id: 'production-agent',
    inputProcessors: [processor],
});
```

## API Reference

### `createContextManager(config?)`

Creates a context manager orchestrator processor.

**Returns**: `{ processor: Processor, config: MergedConfig }`

### Configuration Options

- `thresholds`: Token thresholds for each strategy
- `stepTriggers`: Step-based triggers (min steps, summarize every N steps)
- `retention`: Message retention rules (used to determine what to offload)
- `handlers`: **Your implementations** for each strategy
- `hooks`: Lifecycle hooks for orchestration control
- `strategies`: Enable/disable specific strategies

### Handler Signatures

```typescript
filter?: (args: ProcessInputStepArgs & { estimatedTokens: number }) => Promise<MastraDBMessage[] | undefined>
compact?: (args: ProcessInputStepArgs & { estimatedTokens: number }) => Promise<MastraDBMessage[] | undefined>
summarize?: (args: ProcessInputStepArgs & { estimatedTokens: number; oldMessages: MastraDBMessage[]; recentMessages: MastraDBMessage[] }) => Promise<MastraDBMessage[] | undefined>
offload?: (args: ProcessInputStepArgs & { estimatedTokens: number; messagesToOffload: MastraDBMessage[]; messagesToKeep: MastraDBMessage[] }) => Promise<MastraDBMessage[] | undefined>
```

## Integration with Mastra

### Using TokenLimiterProcessor (Mastra's Only Native Context Management)

Mastra provides **only one native context management tool**: `TokenLimiterProcessor`. It filters messages to fit within a token limit, prioritizing recent messages. Perfect for the `filter` handler:

```typescript
import { TokenLimiterProcessor } from '@mastra/core/processors';

handlers: {
    filter: async args => {
        const limiter = new TokenLimiterProcessor(40000);
        return await limiter.processInput(args);
    };
}
```

**Note**: `TokenLimiterProcessor` only truncates messages - it doesn't summarize, compact, or offload. For those strategies, you need to implement your own handlers.

### What About Memory.lastMessages?

`Memory.lastMessages` limits how many messages are **retrieved from storage**, not how many are sent to the LLM. It's useful for:

- Reducing storage queries
- Limiting initial context load

But it doesn't help with:

- Active context management during execution
- Step-based context reduction
- Token-based context management
- Multi-strategy orchestration

**Use this orchestrator** for active context management during agent execution.

## Production Features

### ✅ Error Handling

Handlers are wrapped in try-catch. Errors are passed to `onError` hook - you decide how to handle them.

### ✅ Validation

Handler return values are validated by default (can be disabled with `validateHandlers: false`).

### ✅ Accurate Token Counting

Use `tokenCounter` config option to provide tiktoken or custom counting function.

### ✅ Observability Hooks

`onError` and `onValidationError` hooks for logging/metrics - not baked in, you implement.

### ✅ Safe Rollback

Original messages are preserved - if handlers fail, original messages are used.

## Best Practices

1. **Use accurate token counting**: Provide `tokenCounter` with tiktoken for production
2. **Use Mastra's built-ins**: Leverage `TokenLimiterProcessor` for filtering
3. **Implement observability hooks**: Use `onError` and `onValidationError` for logging/metrics
4. **Keep handlers focused**: Each handler should do one thing well
5. **Return undefined to skip**: If a handler returns `undefined`, the strategy is skipped
6. **Use hooks for control**: Don't put orchestration logic in handlers
7. **Handle errors gracefully**: Use `onError` hook to log/metrics, return `true` to continue

## Migration from Old System

If you were using the old system with built-in file I/O:

```typescript
// Old way (had file I/O built-in)
const { processor } = createContextManager();

// New way (orchestration-only)
const { processor } = createContextManager({
    handlers: {
        offload: async ({ messagesToOffload, messagesToKeep }) => {
            // Your storage logic here
            await yourStorage.save(messagesToOffload);
            return [...messagesToKeep, referenceMessage];
        },
    },
});
```

## Why Orchestration-Only?

1. **Flexibility**: Use any storage solution (S3, database, files, etc.)
2. **Separation of concerns**: Orchestration vs implementation
3. **Composability**: Works with Mastra's built-in processors
4. **Testability**: Easy to test handlers independently
5. **No premature abstractions**: You decide how to implement strategies
