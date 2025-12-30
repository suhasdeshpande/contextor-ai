/**
 * Preset configurations for common use cases
 */

import type { ContextManagerConfig } from './types.js';

/**
 * Conservative preset - applies strategies at higher thresholds
 * Good for: Agents with large context windows (200k+ tokens)
 */
export const conservativePreset: ContextManagerConfig = {
    thresholds: {
        filter: 150000,
        compact: 180000,
        summarize: 190000,
        offload: 195000,
    },
    stepTriggers: {
        minStepsForCompact: 20,
        minStepsForOffload: 10,
        summarizeEvery: 30,
    },
};

/**
 * Balanced preset - default thresholds
 * Good for: Most agents with standard context windows (128k tokens)
 */
export const balancedPreset: ContextManagerConfig = {
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
};

/**
 * Aggressive preset - applies strategies early
 * Good for: Agents with small context windows (32k-64k tokens) or very long-running tasks
 */
export const aggressivePreset: ContextManagerConfig = {
    thresholds: {
        filter: 20000,
        compact: 30000,
        summarize: 40000,
        offload: 35000,
    },
    stepTriggers: {
        minStepsForCompact: 5,
        minStepsForOffload: 3,
        summarizeEvery: 10,
    },
};
