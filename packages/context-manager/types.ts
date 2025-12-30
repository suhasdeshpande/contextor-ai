import type { ProcessInputStepArgs } from '@mastra/core/processors';
import type { MastraDBMessage } from '@mastra/core/agent/message-list';

/**
 * Strategy handlers - developers implement these
 */
export interface ContextStrategyHandlers {
    /**
     * Filter large messages/results
     * Return modified messages array or undefined to skip
     */
    filter?: (
        args: ProcessInputStepArgs & { estimatedTokens: number }
    ) => Promise<MastraDBMessage[] | undefined> | MastraDBMessage[] | undefined;

    /**
     * Compact large messages (e.g., save to external storage, replace with reference)
     * Return modified messages array or undefined to skip
     */
    compact?: (
        args: ProcessInputStepArgs & { estimatedTokens: number }
    ) => Promise<MastraDBMessage[] | undefined> | MastraDBMessage[] | undefined;

    /**
     * Summarize old messages
     * Return modified messages array or undefined to skip
     */
    summarize?: (
        args: ProcessInputStepArgs & {
            estimatedTokens: number;
            oldMessages: MastraDBMessage[];
            recentMessages: MastraDBMessage[];
        }
    ) => Promise<MastraDBMessage[] | undefined> | MastraDBMessage[] | undefined;

    /**
     * Offload messages to external storage
     * Return modified messages array or undefined to skip
     */
    offload?: (
        args: ProcessInputStepArgs & {
            estimatedTokens: number;
            messagesToOffload: MastraDBMessage[];
            messagesToKeep: MastraDBMessage[];
        }
    ) => Promise<MastraDBMessage[] | undefined> | MastraDBMessage[] | undefined;
}

/**
 * Lifecycle hooks for orchestration control and observability
 */
export interface ContextManagerHooks {
    /**
     * Called before any strategy is evaluated
     * Return false to skip all context management for this step
     */
    beforeProcess?: (args: ProcessInputStepArgs) => boolean | Promise<boolean>;

    /**
     * Called before each strategy to decide if it should run
     * Return false to skip this strategy
     */
    shouldRunStrategy?: (
        strategy: 'filter' | 'compact' | 'summarize' | 'offload',
        args: ProcessInputStepArgs,
        estimatedTokens: number
    ) => boolean | Promise<boolean>;

    /**
     * Called after messages are modified by any strategy
     * Can further modify or validate the messages
     */
    afterModify?: (
        args: ProcessInputStepArgs,
        modifiedMessages: MastraDBMessage[],
        strategy: string
    ) => MastraDBMessage[] | Promise<MastraDBMessage[]>;

    /**
     * Called when a handler throws an error
     * Use this for observability/logging/metrics
     * Return true to continue with original messages, false to abort
     */
    onError?: (
        error: Error,
        strategy: 'filter' | 'compact' | 'summarize' | 'offload',
        args: ProcessInputStepArgs
    ) => boolean | Promise<boolean>;

    /**
     * Called when handler returns invalid data
     * Use this for observability/logging/metrics
     * Return true to continue with original messages, false to abort
     */
    onValidationError?: (
        strategy: 'filter' | 'compact' | 'summarize' | 'offload',
        args: ProcessInputStepArgs,
        reason: string
    ) => boolean | Promise<boolean>;
}

/**
 * Token counting function - use for accurate token estimation
 * Default uses char/4 approximation, but you can provide tiktoken or custom function
 */
export type TokenCounter = (
    messages: MastraDBMessage[],
    model?: string
) => number | Promise<number>;

/**
 * Configuration for context management orchestration
 */
export interface ContextManagerConfig {
    /**
     * Token thresholds for each strategy
     */
    thresholds?: {
        filter?: number;
        compact?: number;
        summarize?: number;
        offload?: number;
    };

    /**
     * Step-based triggers
     */
    stepTriggers?: {
        minStepsForCompact?: number;
        minStepsForOffload?: number;
        summarizeEvery?: number;
    };

    /**
     * Message retention settings (used to determine which messages to offload)
     */
    retention?: {
        keepRecent?: number;
        keepUserMessages?: boolean;
        keepSystemMessages?: boolean;
    };

    /**
     * Strategy handlers - implement your own logic here
     */
    handlers?: ContextStrategyHandlers;

    /**
     * Lifecycle hooks for orchestration control and observability
     */
    hooks?: ContextManagerHooks;

    /**
     * Enable/disable specific strategies
     */
    strategies?: {
        filter?: boolean;
        compact?: boolean;
        summarize?: boolean;
        offload?: boolean;
    };

    /**
     * Token counting function - defaults to char/4 approximation
     * Provide tiktoken or custom function for accurate counting
     */
    tokenCounter?: TokenCounter;

    /**
     * Whether to validate handler return values (default: true)
     * Set to false if handlers are trusted and you want to skip validation overhead
     */
    validateHandlers?: boolean;
}

/**
 * Default configuration
 */
export const DEFAULT_CONFIG: Required<
    Omit<ContextManagerConfig, 'handlers' | 'hooks' | 'tokenCounter'>
> & {
    handlers: ContextStrategyHandlers;
    hooks: ContextManagerHooks;
    tokenCounter: TokenCounter;
} = {
    thresholds: {
        filter: 40000,
        compact: 50000,
        summarize: 70000,
        offload: 60000,
    },
    stepTriggers: {
        minStepsForCompact: 10,
        minStepsForOffload: 5,
        summarizeEvery: 20,
    },
    retention: {
        keepRecent: 5,
        keepUserMessages: true,
        keepSystemMessages: true,
    },
    handlers: {},
    hooks: {},
    strategies: {
        filter: true,
        compact: true,
        summarize: true,
        offload: true,
    },
    tokenCounter: messages => {
        // Default: char/4 approximation
        const totalChars = messages.reduce((sum, msg) => {
            const content =
                typeof msg.content === 'string' ? msg.content : JSON.stringify(msg.content);
            return sum + content.length;
        }, 0);
        return totalChars / 4;
    },
    validateHandlers: true,
};
