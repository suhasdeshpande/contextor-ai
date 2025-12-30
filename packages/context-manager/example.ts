/**
 * Example usage of Contextor
 *
 * This demonstrates how to use framework processors (e.g., Mastra's TokenLimiterProcessor) and custom handlers
 */

import { createContextManager } from './index.js';
import { TokenLimiterProcessor } from '@mastra/core/processors'; // Example: Mastra's processor
import { Agent } from '@mastra/core/agent';
import { Memory } from '@mastra/memory';
import { Tiktoken } from 'js-tiktoken/lite';
import o200k_base from 'js-tiktoken/ranks/o200k_base';
import type { MastraDBMessage } from '@mastra/core/agent/message-list';
import { stringToContentV2 } from './utils.js';
import { stringToContentV2 } from './utils.js';
import type { MastraDBMessage } from '@mastra/core/agent/message-list';

// ============================================================================
// Example 1: Using Mastra's TokenLimiterProcessor for filtering
// ============================================================================

export function example1_WithTokenLimiter() {
    const { processor } = createContextManager({
        handlers: {
            // Use Mastra's built-in token limiter
            filter: async args => {
                const limiter = new TokenLimiterProcessor(40000);
                return await limiter.processInput(args);
            },
        },
    });

    const agent = new Agent({
        id: 'token-limited-agent',
        inputProcessors: [processor],
        memory: new Memory(),
    });

    return agent;
}

// ============================================================================
// Example 2: Custom offloading handler (file-based)
// ============================================================================

export function example2_CustomOffloading() {
    const { processor } = createContextManager({
        handlers: {
            offload: async ({ messagesToOffload, messagesToKeep, stepNumber }) => {
                // Your custom offloading logic here
                // e.g., save to database, S3, etc.
                const offloadData = {
                    stepNumber,
                    timestamp: new Date().toISOString(),
                    messages: messagesToOffload,
                };

                // Example: Save to file (you'd use your own storage solution)
                // await saveToStorage(`offload-${stepNumber}.json`, offloadData);

                // Return modified messages with reference
                const referenceMessage: MastraDBMessage = {
                    id: `offload-ref-${stepNumber}`,
                    role: 'system',
                    content: stringToContentV2(
                        `[Context offloaded: ${messagesToOffload.length} messages saved. Retrieve from storage if needed.]`
                    ),
                    createdAt: new Date(),
                };

                return [...messagesToKeep, referenceMessage];
            },
        },
    });

    const agent = new Agent({
        id: 'custom-offload-agent',
        inputProcessors: [processor],
        memory: new Memory(),
    });

    return agent;
}

// ============================================================================
// Example 3: Custom summarization handler (LLM-based)
// ============================================================================

export function example3_LLMSummarization() {
    const { processor } = createContextManager({
        handlers: {
            summarize: async ({ oldMessages, recentMessages, stepNumber }) => {
                // Your custom summarization logic here
                // e.g., call an LLM to summarize, use a summarization service, etc.

                // Example: Create a summary message
                const summaryMessage: MastraDBMessage = {
                    id: `summary-${stepNumber}`,
                    role: 'system',
                    content: stringToContentV2(
                        `[Summary of ${oldMessages.length} previous messages: Key topics and actions covered in the conversation.]`
                    ),
                    createdAt: new Date(),
                };

                return [summaryMessage, ...recentMessages];
            },
        },
    });

    const agent = new Agent({
        id: 'llm-summary-agent',
        inputProcessors: [processor],
        memory: new Memory(),
    });

    return agent;
}

// ============================================================================
// Example 4: Complete example with all handlers
// ============================================================================

export function example4_Complete() {
    const { processor } = createContextManager({
        thresholds: {
            filter: 40000,
            compact: 50000,
            summarize: 70000,
            offload: 60000,
        },
        handlers: {
            // Use Mastra's TokenLimiter
            filter: async args => {
                const limiter = new TokenLimiterProcessor(40000);
                return await limiter.processInput(args);
            },

            // Custom compaction
            compact: async ({ messages, estimatedTokens }) => {
                // Your compaction logic
                return messages; // Return modified messages
            },

            // Custom summarization
            summarize: async ({ oldMessages, recentMessages }) => {
                // Your summarization logic
                const summary: MastraDBMessage = {
                    id: `summary-${Date.now()}`,
                    role: 'system',
                    content: stringToContentV2(`[Summary of ${oldMessages.length} messages]`),
                    createdAt: new Date(),
                };
                return [summary, ...recentMessages];
            },

            // Custom offloading
            offload: async ({ messagesToOffload, messagesToKeep }) => {
                // Your offloading logic
                const reference: MastraDBMessage = {
                    id: `offload-ref-${Date.now()}`,
                    role: 'system',
                    content: stringToContentV2(`[Offloaded ${messagesToOffload.length} messages]`),
                    createdAt: new Date(),
                };
                return [...messagesToKeep, reference];
            },
        },
        hooks: {
            beforeProcess: async args => {
                // Skip for first 5 steps
                return args.stepNumber >= 5;
            },
            shouldRunStrategy: async (strategy, args, tokens) => {
                // Custom logic to decide if strategy should run
                return true;
            },
            // Observability hooks (not baked in - you implement)
            onError: async (error, strategy, args) => {
                console.error(`[Context Manager] ${strategy} handler failed:`, error);
                // metrics.increment('context_manager.error', { strategy });
                return true; // Continue with original messages
            },
            onValidationError: async (strategy, args, reason) => {
                console.warn(`[Context Manager] ${strategy} validation failed:`, reason);
                // metrics.increment('context_manager.validation_error', { strategy });
                return true; // Continue with original messages
            },
            afterModify: async (args, messages, strategy) => {
                console.log(`Applied ${strategy} strategy`);
                // metrics.increment('context_manager.strategy', { strategy });
                return messages;
            },
        },
    });

    const agent = new Agent({
        id: 'production-agent',
        inputProcessors: [processor],
        memory: new Memory(),
    });

    return agent;
}
