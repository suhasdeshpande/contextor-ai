/**
 * Context Manager Orchestrator for Mastra Agents
 *
 * Orchestrates WHEN context management strategies should run, not HOW.
 * Developers implement strategies via handlers. No file I/O or direct manipulation.
 *
 * @example
 * ```typescript
 * import { createContextManager } from './context-manager';
 * import { TokenLimiterProcessor } from '@mastra/core/processors';
 *
 * // Use Mastra's built-in TokenLimiter for filtering
 * const { processor } = createContextManager({
 *   handlers: {
 *     filter: async (args) => {
 *       const limiter = new TokenLimiterProcessor(40000);
 *       return await limiter.processInput(args);
 *     }
 *   }
 * });
 * ```
 */

import type {
    Processor,
    ProcessInputStepArgs,
    ProcessInputStepResult,
} from '@mastra/core/processors';
import type { MastraDBMessage } from '@mastra/core/agent/message-list';
import type {
    ContextManagerConfig,
    ContextStrategyHandlers,
    ContextManagerHooks,
} from './types.js';
import { DEFAULT_CONFIG } from './types.js';
import { shouldKeepMessage } from './utils.js';
import { validateMessages, getValidationError } from './validation.js';

/**
 * Creates a context manager orchestrator processor
 */
export function createContextManager(config: ContextManagerConfig = {}): {
    processor: Processor<'context-manager'> & {
        processInputStep: (
            args: ProcessInputStepArgs
        ) => Promise<ProcessInputStepResult | undefined>;
    };
    config: Required<Omit<ContextManagerConfig, 'handlers' | 'hooks'>> & {
        handlers: ContextStrategyHandlers;
        hooks: ContextManagerHooks;
    };
} {
    // Merge with defaults
    const mergedConfig: Required<
        Omit<ContextManagerConfig, 'handlers' | 'hooks' | 'tokenCounter'>
    > & {
        handlers: ContextStrategyHandlers;
        hooks: ContextManagerHooks;
        tokenCounter: (messages: MastraDBMessage[], model?: string) => number | Promise<number>;
    } = {
        thresholds: { ...DEFAULT_CONFIG.thresholds, ...config.thresholds },
        stepTriggers: { ...DEFAULT_CONFIG.stepTriggers, ...config.stepTriggers },
        retention: { ...DEFAULT_CONFIG.retention, ...config.retention },
        handlers: { ...DEFAULT_CONFIG.handlers, ...config.handlers },
        hooks: { ...DEFAULT_CONFIG.hooks, ...config.hooks },
        strategies: { ...DEFAULT_CONFIG.strategies, ...config.strategies },
        tokenCounter: config.tokenCounter || DEFAULT_CONFIG.tokenCounter,
        validateHandlers: config.validateHandlers ?? DEFAULT_CONFIG.validateHandlers,
    };

    const processor = {
        id: 'context-manager',
        name: 'Context Manager Orchestrator',

        processInputStep: async (
            args: ProcessInputStepArgs
        ): Promise<ProcessInputStepResult | undefined> => {
            const { messages, stepNumber, model } = args;
            const {
                handlers,
                hooks,
                thresholds,
                stepTriggers,
                strategies,
                retention,
                tokenCounter,
                validateHandlers,
            } = mergedConfig;

            // Keep original messages safe for rollback (used implicitly for rollback)

            // Lifecycle hook: beforeProcess
            if (hooks.beforeProcess) {
                try {
                    const shouldContinue = await hooks.beforeProcess(args);
                    if (!shouldContinue) {
                        return undefined;
                    }
                } catch (error) {
                    // If beforeProcess throws, abort gracefully
                    if (hooks.onError) {
                        const shouldContinue = await hooks.onError(error as Error, 'filter', args);
                        if (!shouldContinue) {
                            return undefined;
                        }
                    }
                    return undefined;
                }
            }

            // Calculate current context size using configured token counter
            const estimatedTokens = await tokenCounter(
                messages,
                typeof model === 'string' ? model : undefined
            );

            let modifiedMessages = messages;
            let hasChanges = false;

            /**
             * Safe handler execution wrapper
             */
            const executeHandler = async (
                strategy: 'filter' | 'compact' | 'summarize' | 'offload',
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                handler: (
                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                    args: any
                ) => Promise<MastraDBMessage[] | undefined> | MastraDBMessage[] | undefined,
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                handlerArgs: any
            ): Promise<MastraDBMessage[] | null> => {
                try {
                    const result = await handler(handlerArgs);

                    // Handler returned undefined - skip strategy
                    if (result === undefined) {
                        return null;
                    }

                    // Validate result if validation is enabled
                    if (validateHandlers) {
                        if (!validateMessages(result)) {
                            const errorMsg = getValidationError(result);
                            if (hooks.onValidationError) {
                                const shouldContinue = await hooks.onValidationError(
                                    strategy,
                                    args,
                                    errorMsg || 'Invalid handler return'
                                );
                                if (!shouldContinue) {
                                    return null; // Skip strategy on validation error
                                }
                            }
                            // If no hook or hook says continue, use original messages
                            return null;
                        }
                    }

                    return result;
                } catch (error) {
                    // Handler threw - use error hook if available
                    if (hooks.onError) {
                        const shouldContinue = await hooks.onError(error as Error, strategy, args);
                        if (!shouldContinue) {
                            // Hook says abort - return null to skip strategy
                            return null;
                        }
                    }
                    // If no hook or hook says continue, skip strategy (use original messages)
                    return null;
                }
            };

            // Strategy 1: Filter
            if (
                strategies.filter &&
                handlers.filter &&
                estimatedTokens > (thresholds.filter ?? 0)
            ) {
                const shouldRun = hooks.shouldRunStrategy
                    ? await hooks.shouldRunStrategy('filter', args, estimatedTokens)
                    : true;

                if (shouldRun) {
                    const filtered = await executeHandler('filter', handlers.filter, {
                        ...args,
                        estimatedTokens,
                    });
                    if (filtered) {
                        modifiedMessages = filtered;
                        hasChanges = true;

                        if (hooks.afterModify) {
                            try {
                                modifiedMessages = await hooks.afterModify(
                                    args,
                                    modifiedMessages,
                                    'filter'
                                );
                            } catch (error) {
                                // If afterModify throws, rollback to previous state
                                if (hooks.onError) {
                                    await hooks.onError(error as Error, 'filter', args);
                                }
                                modifiedMessages = messages; // Rollback
                                hasChanges = false; // Mark as no changes since we rolled back
                            }
                        }
                    }
                }
            }

            // Strategy 2: Compact
            if (
                strategies.compact &&
                handlers.compact &&
                stepNumber >= (stepTriggers.minStepsForCompact ?? 5) &&
                estimatedTokens > (thresholds.compact ?? 0)
            ) {
                const shouldRun = hooks.shouldRunStrategy
                    ? await hooks.shouldRunStrategy('compact', args, estimatedTokens)
                    : true;

                if (shouldRun) {
                    const compacted = await executeHandler('compact', handlers.compact, {
                        ...args,
                        messages: modifiedMessages,
                        estimatedTokens,
                    });
                    if (compacted) {
                        modifiedMessages = compacted;
                        hasChanges = true;

                        if (hooks.afterModify) {
                            try {
                                modifiedMessages = await hooks.afterModify(
                                    args,
                                    modifiedMessages,
                                    'compact'
                                );
                            } catch (error) {
                                if (hooks.onError) {
                                    await hooks.onError(error as Error, 'compact', args);
                                }
                                modifiedMessages = messages; // Rollback
                                hasChanges = false; // Mark as no changes since we rolled back
                            }
                        }
                    }
                }
            }

            // Strategy 3: Summarize
            const summarizeEvery = stepTriggers.summarizeEvery ?? 20;
            if (
                strategies.summarize &&
                handlers.summarize &&
                stepNumber >= summarizeEvery &&
                stepNumber % summarizeEvery === 0 &&
                estimatedTokens > (thresholds.summarize ?? 0)
            ) {
                const shouldRun = hooks.shouldRunStrategy
                    ? await hooks.shouldRunStrategy('summarize', args, estimatedTokens)
                    : true;

                if (shouldRun) {
                    const keepCount = retention.keepRecent || 5;
                    const recentMessages = modifiedMessages.slice(-keepCount);
                    const oldMessages = modifiedMessages.slice(0, -keepCount);

                    if (oldMessages.length > 0) {
                        const summarized = await executeHandler('summarize', handlers.summarize, {
                            ...args,
                            messages: modifiedMessages,
                            estimatedTokens,
                            oldMessages,
                            recentMessages,
                        });

                        if (summarized) {
                            modifiedMessages = summarized;
                            hasChanges = true;

                            if (hooks.afterModify) {
                                try {
                                    modifiedMessages = await hooks.afterModify(
                                        args,
                                        modifiedMessages,
                                        'summarize'
                                    );
                                } catch (error) {
                                    if (hooks.onError) {
                                        await hooks.onError(error as Error, 'summarize', args);
                                    }
                                    modifiedMessages = messages; // Rollback
                                    hasChanges = false; // Mark as no changes since we rolled back
                                }
                            }
                        }
                    }
                }
            }

            // Strategy 4: Offload
            if (
                strategies.offload &&
                handlers.offload &&
                stepNumber >= (stepTriggers.minStepsForOffload ?? 10) &&
                estimatedTokens > (thresholds.offload ?? 50000)
            ) {
                const shouldRun = hooks.shouldRunStrategy
                    ? await hooks.shouldRunStrategy('offload', args, estimatedTokens)
                    : true;

                if (shouldRun) {
                    // Determine which messages to offload vs keep
                    const messagesToOffload: MastraDBMessage[] = [];
                    const messagesToKeep: MastraDBMessage[] = [];

                    modifiedMessages.forEach((msg, idx) => {
                        if (
                            shouldKeepMessage(msg, idx, modifiedMessages.length, {
                                keepRecent: retention.keepRecent,
                                keepUserMessages: retention.keepUserMessages,
                                keepSystemMessages: retention.keepSystemMessages,
                            })
                        ) {
                            messagesToKeep.push(msg);
                        } else {
                            messagesToOffload.push(msg);
                        }
                    });

                    if (messagesToOffload.length > 0) {
                        const offloaded = await executeHandler('offload', handlers.offload, {
                            ...args,
                            messages: modifiedMessages,
                            estimatedTokens,
                            messagesToOffload,
                            messagesToKeep,
                        });

                        if (offloaded) {
                            modifiedMessages = offloaded;
                            hasChanges = true;

                            if (hooks.afterModify) {
                                try {
                                    modifiedMessages = await hooks.afterModify(
                                        args,
                                        modifiedMessages,
                                        'offload'
                                    );
                                } catch (error) {
                                    if (hooks.onError) {
                                        await hooks.onError(error as Error, 'offload', args);
                                    }
                                    modifiedMessages = messages; // Rollback
                                    hasChanges = false; // Mark as no changes since we rolled back
                                }
                            }
                        }
                    }
                }
            }

            if (hasChanges) {
                return { messages: modifiedMessages };
            }

            return undefined;
        },
    } satisfies Processor<'context-manager'>;

    return { processor, config: mergedConfig };
}

// Export types and utilities
export * from './types.js';
export * from './utils.js';
export * from './validation.js';
