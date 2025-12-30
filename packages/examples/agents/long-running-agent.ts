import { Agent } from '@mastra/core/agent';
import { Memory } from '@mastra/memory';
import { LibSQLStore } from '@mastra/libsql';
import { TokenLimiterProcessor } from '@mastra/core/processors';
import type { ProcessInputStepResult } from '@mastra/core/processors';
import {
    writeFileTool,
    readFileTool,
    listFilesTool,
    executeBashTool,
} from '../tools/bash-tools.js';
import { createContextManager, stringToContentV2 } from '@contextor-ai/core';
import type { MastraDBMessage } from '@mastra/core/agent/message-list';

// Helper to count tokens (rough estimate: 1 token ≈ 4 chars)
function countTokens(messages: MastraDBMessage[]): number {
    return (
        messages.reduce((sum, msg) => {
            const content =
                typeof msg.content === 'string' ? msg.content : JSON.stringify(msg.content);
            return sum + content.length;
        }, 0) / 4
    );
}

/**
 * Long-running agent with context management processors
 *
 * This agent demonstrates how to handle agents with many steps (30-50+)
 * using processInputStep processors for context management:
 *
 * 1. Offloading Context - Save old messages to files
 * 2. Reducing Context - Compact, summarize, filter messages
 * 3. Isolating Context - Prepare for sub-agent delegation
 */
export const longRunningAgent = new Agent({
    id: 'long-running-agent',
    name: 'Long Running Agent',
    instructions: `
      You are a capable assistant that can handle long-running, multi-step tasks.

      You have access to tools for:
      - File operations (write, read, list)
      - Bash command execution

      When working on complex tasks:
      - Break them down into smaller steps
      - Use files to store intermediate results
      - Reference previous work when needed
      - Be thorough but efficient
    `,
    model: 'anthropic/claude-sonnet-4-5',
    tools: {
        writeFile: writeFileTool,
        readFile: readFileTool,
        listFiles: listFilesTool,
        executeBash: executeBashTool,
    },
    memory: new Memory({
        storage: new LibSQLStore({
            id: 'long-running-agent-memory',
            url: ':memory:', // In-memory database for examples
        }),
    }),

    // Add context management processor with actual handlers that prove value
    inputProcessors: [
        createContextManager({
            // Configure thresholds - strategies trigger when tokens exceed these
            thresholds: {
                filter: 3000, // Filter when > 3k tokens
                compact: 4000, // Compact when > 4k tokens
                summarize: 5000, // Summarize when > 5k tokens
                offload: 6000, // Offload when > 6k tokens
            },
            stepTriggers: {
                minStepsForCompact: 3, // Only compact after 3 steps
                summarizeEvery: 5, // Summarize every 5 steps
                minStepsForOffload: 5, // Only offload after 5 steps
            },
            handlers: {
                // FILTER: Use Mastra's TokenLimiterProcessor to truncate messages
                filter: async args => {
                    const tokensBefore = countTokens(args.messages);
                    const limiter = new TokenLimiterProcessor(5000); // Keep within 5k tokens
                    const result = (await limiter.processInput(args)) as
                        | ProcessInputStepResult
                        | undefined;
                    if (result && 'messages' in result && Array.isArray(result.messages)) {
                        const tokensAfter = countTokens(result.messages);
                        const reduction = ((1 - tokensAfter / tokensBefore) * 100).toFixed(1);
                        console.log(
                            `\n🔍 [FILTER] Step ${args.stepNumber}: ${tokensBefore.toFixed(0)} → ${tokensAfter.toFixed(0)} tokens (${reduction}% reduction)`
                        );
                        return result.messages;
                    }
                    return undefined;
                },
                // COMPACT: Replace large tool outputs with references
                compact: async ({ messages, stepNumber }) => {
                    const tokensBefore = countTokens(messages);
                    const compacted = messages.map(msg => {
                        // If message has large tool output, replace with reference
                        if (
                            msg.role === 'assistant' &&
                            typeof msg.content !== 'string' &&
                            msg.content.format === 2 &&
                            msg.content.parts.some((p: any) => p.type === 'tool_output')
                        ) {
                            const originalSize = countTokens([msg]) * 4;
                            return {
                                ...msg,
                                content: stringToContentV2(
                                    `[Compacted tool output - original was ~${originalSize.toFixed(0)} chars]`
                                ),
                            };
                        }
                        return msg;
                    });
                    const tokensAfter = countTokens(compacted);
                    if (tokensAfter < tokensBefore) {
                        const reduction = ((1 - tokensAfter / tokensBefore) * 100).toFixed(1);
                        console.log(
                            `\n📦 [COMPACT] Step ${stepNumber}: ${tokensBefore.toFixed(0)} → ${tokensAfter.toFixed(0)} tokens (${reduction}% reduction)`
                        );
                        return compacted;
                    }
                    return undefined;
                },
                // SUMMARIZE: Condense old messages into a summary
                summarize: async ({ oldMessages, recentMessages, stepNumber }) => {
                    const tokensBefore = countTokens([...oldMessages, ...recentMessages]);
                    const summary: MastraDBMessage = {
                        id: `summary-${stepNumber}`,
                        role: 'system',
                        content: stringToContentV2(
                            `[Summary of ${oldMessages.length} previous messages - original was ~${countTokens(oldMessages) * 4} chars]`
                        ),
                        createdAt: new Date(),
                    };
                    const summarized = [summary, ...recentMessages];
                    const tokensAfter = countTokens(summarized);
                    const reduction = ((1 - tokensAfter / tokensBefore) * 100).toFixed(1);
                    console.log(
                        `\n📝 [SUMMARIZE] Step ${stepNumber}: ${tokensBefore.toFixed(0)} → ${tokensAfter.toFixed(0)} tokens (${reduction}% reduction)`
                    );
                    return summarized;
                },
                // OFFLOAD: Move old messages to external storage (simulated)
                offload: async ({ messagesToOffload, messagesToKeep, stepNumber }) => {
                    const tokensBefore = countTokens([...messagesToOffload, ...messagesToKeep]);
                    const offloadRef: MastraDBMessage = {
                        id: `offload-ref-${stepNumber}`,
                        role: 'system',
                        content: stringToContentV2(
                            `[Offloaded ${messagesToOffload.length} messages to external storage - original was ~${countTokens(messagesToOffload) * 4} chars]`
                        ),
                        createdAt: new Date(),
                    };
                    const offloaded = [...messagesToKeep, offloadRef];
                    const tokensAfter = countTokens(offloaded);
                    const reduction = ((1 - tokensAfter / tokensBefore) * 100).toFixed(1);
                    console.log(
                        `\n💾 [OFFLOAD] Step ${stepNumber}: ${tokensBefore.toFixed(0)} → ${tokensAfter.toFixed(0)} tokens (${reduction}% reduction)`
                    );
                    return offloaded;
                },
            },
            hooks: {
                afterModify: async (args, messages, strategy) => {
                    const estimatedTokens = countTokens(messages);
                    console.log(
                        `   📊 After ${strategy}: ${estimatedTokens.toFixed(0)} tokens remaining`
                    );
                    return messages;
                },
            },
        }).processor,
    ],
});
