# Context Management for Long-Running Agents

## Overview

When agents run for many steps (30-50+), managing context becomes critical. This guide demonstrates how to use `processInputStep` processors to implement three key strategies:

1. **Offloading Context** - Moving context to external storage
2. **Reducing Context** - Compaction, summarization, filtering
3. **Isolating Context** - Sub-agents with separate context windows

## Understanding `processInputStep`

`processInputStep` is a processor method that runs **before each step** of the agentic loop, allowing you to:

- Transform/modify messages before they're sent to the LLM
- Return modified `messages` array or `messageList`
- Return `ProcessInputStepResult` to change model, tools, toolChoice, etc.
- Access `stepNumber`, `steps` history, `systemMessages`, etc.

### Key Differences from `prepareStep`

| Feature         | `prepareStep`                             | `processInputStep`                                           |
| --------------- | ----------------------------------------- | ------------------------------------------------------------ |
| **Location**    | Passed to `stream()`/`generate()` options | Defined as a Processor                                       |
| **Reusability** | Per-execution                             | Reusable across agents                                       |
| **Return Type** | `ProcessInputStepResult` only             | `ProcessInputStepResult \| MessageList \| MastraDBMessage[]` |
| **Use Case**    | Execution-specific logic                  | Reusable context management                                  |

## Strategy 1: Offloading Context

**Goal**: Move old messages to external storage (files) and replace with references.

### Implementation

```typescript
export const contextOffloadingProcessor: Processor<'context-offloading'> = {
    id: 'context-offloading',
    name: 'Context Offloading Processor',

    processInputStep: async (args: ProcessInputStepArgs) => {
        const { messages, stepNumber } = args;

        // Only offload after certain steps
        if (stepNumber < 5) return undefined;

        // Estimate token usage
        const estimatedTokens = calculateTokens(messages);

        // Offload if context is large (>50k tokens)
        if (estimatedTokens < 50000) return undefined;

        // Save old messages to file
        const offloadFile = `/path/to/offload-step-${stepNumber}.json`;
        await writeFile(offloadFile, JSON.stringify(oldMessages));

        // Replace with reference message
        const referenceMessage: MastraDBMessage = {
            id: `offload-ref-${stepNumber}`,
            role: 'system',
            content: `[Context offloaded to ${offloadFile}. Use readFile to retrieve if needed.]`,
            createdAt: new Date(),
        };

        return { messages: [...recentMessages, referenceMessage] };
    },
};
```

### When to Use

- Context window approaching limit (>80% full)
- Old tool results that have already been acted upon
- Historical conversation that's no longer immediately relevant

## Strategy 2: Reducing Context

### 2a. Compaction

Save full tool results to files, keep only summaries in context.

```typescript
export const contextCompactionProcessor: Processor<'context-compaction'> = {
    processInputStep: async args => {
        // Find large tool results (>1000 chars)
        // Save full result to file
        // Replace with compact summary
        return { messages: compactedMessages };
    },
};
```

**Benefits**:

- Reduces context size significantly
- Full results still accessible via file system
- Agent can retrieve details when needed

### 2b. Summarization

Summarize old message history into a single summary message.

```typescript
export const contextSummarizationProcessor: Processor<'context-summarization'> = {
    processInputStep: async args => {
        // Keep last N messages
        // Summarize older messages
        // Replace with summary message
        return { messages: [summaryMessage, ...recentMessages] };
    },
};
```

**When to Use**:

- Every 20 steps or when context >70k tokens
- Old conversation history that's been acted upon
- Preserve key information while reducing size

### 2c. Filtering

Truncate excessively large tool results.

```typescript
export const contextFilteringProcessor: Processor<'context-filtering'> = {
    processInputStep: async args => {
        // Find tool results >5000 chars
        // Truncate and add note
        return { messages: filteredMessages };
    },
};
```

**When to Use**:

- Large file reads or command outputs
- Prevent single messages from consuming too much context
- First line of defense before compaction

## Strategy 3: Isolating Context

Use sub-agents with separate context windows for isolated tasks.

### Implementation Pattern

```typescript
// 1. Create a delegation tool
const delegateToSubAgentTool = createTool({
    id: 'delegate-to-sub-agent',
    description: 'Delegate a complex task to a sub-agent',
    inputSchema: z.object({
        task: z.string(),
        context: z.string().optional(),
    }),
    execute: async ({ task, context }) => {
        // Create sub-agent with its own context
        const subAgent = new Agent({
            /* ... */
        });

        // Run sub-agent with isolated context
        const result = await subAgent.generate(task, {
            threadId: `sub-${Date.now()}`,
            // Sub-agent has access to same file system
            // but separate conversation context
        });

        return { result: result.text };
    },
});

// 2. Processor detects complex tasks
export const subAgentPreparationProcessor: Processor<'sub-agent-prep'> = {
    processInputStep: async args => {
        // Detect complex multi-step tasks
        // Suggest using delegation tool
        return { toolChoice: { type: 'tool', toolName: 'delegateToSubAgent' } };
    },
};
```

### Benefits

- **Isolated Context**: Sub-agent operates with its own context window
- **Shared Storage**: Both agents can access same file system
- **Parallel Execution**: Multiple sub-agents can work simultaneously
- **Clean Separation**: Parent agent gets clean result, not full conversation

## Smart Context Manager

A combined processor that intelligently applies all strategies:

```typescript
export const smartContextManagerProcessor: Processor<'smart-context-manager'> = {
    processInputStep: async args => {
        const { messages, stepNumber } = args;
        const estimatedTokens = calculateTokens(messages);

        // Apply strategies based on thresholds
        if (estimatedTokens > 40000) {
            // Filter large results
        }
        if (estimatedTokens > 50000) {
            // Compact tool results
        }
        if (stepNumber % 20 === 0 && estimatedTokens > 70000) {
            // Summarize old messages
        }
        if (estimatedTokens > 60000) {
            // Offload to files
        }

        return { messages: modifiedMessages };
    },
};
```

## Usage Example

```typescript
import { longRunningAgent } from './agents/long-running-agent';

// Agent automatically manages context via processors
const stream = await longRunningAgent.stream(messages, {
    threadId: 'long-task',
    resourceId: 'user-123',
    maxSteps: 50, // Can handle many steps!
});

for await (const chunk of stream.fullStream) {
    // Process chunks
}
```

## Best Practices

1. **Start Early**: Apply filtering/compaction before context gets too large
2. **Monitor Token Usage**: Track estimated tokens at each step
3. **Preserve User Messages**: Always keep user messages, they're critical
4. **Make Retrievable**: When offloading, ensure agent can retrieve via tools
5. **Test Thresholds**: Adjust thresholds based on your model's context window
6. **Combine Strategies**: Use multiple processors in sequence for best results

## Token Estimation

Rough approximation: **1 token ≈ 4 characters**

```typescript
function estimateTokens(messages: MastraDBMessage[]): number {
    const totalChars = messages.reduce((sum, msg) => {
        const content = typeof msg.content === 'string' ? msg.content : JSON.stringify(msg.content);
        return sum + content.length;
    }, 0);
    return totalChars / 4;
}
```

## References

- [Mastra Processors Documentation](https://mastra.ai/docs/processors)
- [processInputStep API](https://mastra.ai/docs/processors#processinputstep)
- Example implementations: `src/mastra/processors/context-management.ts`
