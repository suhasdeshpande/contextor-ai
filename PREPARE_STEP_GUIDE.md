# Understanding `prepareStep` Message Format

## Overview

According to the [Mastra v1 migration guide](https://mastra.ai/guides/v1/migrations/upgrade-to-v1/agent#preparestep-messages-format), the `prepareStep` callback now receives messages in **MastraDBMessage format** instead of the AI SDK v5 ModelMessage format.

## Key Changes

### Before (v0.x)

```typescript
agent.generate({
    prompt: 'Hello',
    prepareStep: async ({ messages }) => {
        // messages was AI SDK v5 ModelMessage format
        console.log(messages[0].content); // Direct access
    },
});
```

### After (v1.x)

```typescript
agent.generate({
    prompt: 'Hello',
    prepareStep: async ({ messages, messageList }) => {
        // messages is now MastraDBMessage format
        console.log(messages[0].content);

        // Use messageList to get AI SDK v5 format if needed:
        const aiSdkMessages = messageList.get.all.aiV5.model();
        console.log(aiSdkMessages[0].content);
    },
});
```

## Message Format Differences

### MastraDBMessage Format (NEW - Default)

```typescript
{
  id: string;                    // Unique message ID
  role: 'user' | 'assistant' | 'system' | 'tool';
  content: string | Array<{      // Content can be string or array
    type: string;
    // ... other properties
  }>;
  createdAt: Date;               // Timestamp
  metadata?: Record<string, any>; // Optional metadata
}
```

### AI SDK v5 ModelMessage Format (OLD - Available via messageList)

```typescript
{
    role: 'user' | 'assistant' | 'system' | 'tool';
    content: string |
        Array<{
            // Content can be string or array
            type: string;
            // ... other properties
        }>;
    // No id, createdAt, or metadata fields
}
```

## Why This Change?

1. **Unification**: `prepareStep` now uses the same format as `processInputStep` processor method
2. **Consistency**: All Mastra APIs now use MastraDBMessage format internally
3. **Metadata Support**: Access to message IDs, timestamps, and custom metadata
4. **Better Integration**: Easier to work with Mastra's memory and storage systems

## Practical Examples

### Example 1: Inspecting Messages

```typescript
prepareStep: async ({ messages, messageList }) => {
    console.log('Total messages:', messages.length);

    // Access MastraDBMessage format
    const lastMessage = messages[messages.length - 1];
    console.log('Last message ID:', lastMessage.id);
    console.log('Last message role:', lastMessage.role);
    console.log('Created at:', lastMessage.createdAt);

    // If you need AI SDK v5 format for compatibility
    const aiSdkMessages = messageList.get.all.aiV5.model();
    console.log('AI SDK format:', aiSdkMessages);

    return { toolChoice: 'auto' };
};
```

### Example 2: Conditional Tool Choice

```typescript
prepareStep: async ({ messages }) => {
    const lastMessage = messages[messages.length - 1];
    const content = typeof lastMessage.content === 'string' ? lastMessage.content : '';

    if (content.toLowerCase().includes('write file')) {
        return {
            toolChoice: {
                type: 'tool',
                toolName: 'writeFile',
            },
        };
    }

    return { toolChoice: 'auto' };
};
```

### Example 3: Message Filtering

```typescript
prepareStep: async ({ messages, messageList }) => {
    // Filter messages based on metadata
    const recentMessages = messages.filter(msg => {
        const age = Date.now() - msg.createdAt.getTime();
        return age < 60000; // Last minute
    });

    // Get AI SDK format for filtered messages
    const aiSdkMessages = messageList.get.all.aiV5.model();

    return { toolChoice: 'auto' };
};
```

## Migration Checklist

- [ ] Update `prepareStep` callbacks to use MastraDBMessage format
- [ ] Use `messageList.get.all.aiV5.model()` if you need old format
- [ ] Update any code that accessed `messages[0].content` directly
- [ ] Test that tool choice logic still works correctly
- [ ] Update any message filtering or processing logic

## Testing

Run the example:

```bash
bun run test-prepare-step.ts
```

This will demonstrate:

- How messages are received in MastraDBMessage format
- How to access AI SDK v5 format using messageList
- How to control tool choice based on message content
- Multi-turn conversation handling

## References

- [Mastra Migration Guide](https://mastra.ai/guides/v1/migrations/upgrade-to-v1/agent#preparestep-messages-format)
- Example implementation: `src/mastra/agents/prepare-step-example.ts`
- Test script: `test-prepare-step.ts`
