import type { MastraDBMessage } from '@mastra/core/agent/message-list';

/**
 * Validates that a value is a valid MastraDBMessage array
 */
export function validateMessages(messages: unknown): messages is MastraDBMessage[] {
    if (!Array.isArray(messages)) {
        return false;
    }

    if (messages.length === 0) {
        return false; // Empty array is invalid - should return undefined to skip
    }

    return messages.every(msg => {
        if (!msg || typeof msg !== 'object') {
            return false;
        }

        // Required fields
        if (typeof msg.id !== 'string' || !msg.id) {
            return false;
        }

        if (!['user', 'assistant', 'system'].includes(msg.role)) {
            return false;
        }

        if (!msg.content || typeof msg.content !== 'object') {
            return false;
        }

        // Validate content format
        if (msg.content.format !== 2) {
            return false;
        }

        if (!Array.isArray(msg.content.parts)) {
            return false;
        }

        if (!(msg.createdAt instanceof Date)) {
            return false;
        }

        return true;
    });
}

/**
 * Get validation error message for debugging
 */
export function getValidationError(messages: unknown): string | null {
    if (!Array.isArray(messages)) {
        return 'Handler returned non-array value';
    }

    if (messages.length === 0) {
        return 'Handler returned empty array (should return undefined to skip)';
    }

    for (let i = 0; i < messages.length; i++) {
        const msg = messages[i];
        if (!msg || typeof msg !== 'object') {
            return `Message ${i} is not an object`;
        }

        if (typeof msg.id !== 'string' || !msg.id) {
            return `Message ${i} missing or invalid id`;
        }

        if (!['user', 'assistant', 'system'].includes(msg.role)) {
            return `Message ${i} has invalid role: ${msg.role}`;
        }

        if (!msg.content || typeof msg.content !== 'object') {
            return `Message ${i} missing or invalid content`;
        }

        if (msg.content.format !== 2) {
            return `Message ${i} content format is not 2`;
        }

        if (!Array.isArray(msg.content.parts)) {
            return `Message ${i} content.parts is not an array`;
        }

        if (!(msg.createdAt instanceof Date)) {
            return `Message ${i} createdAt is not a Date`;
        }
    }

    return null;
}
