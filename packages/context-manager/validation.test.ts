import { describe, it, expect } from 'bun:test';
import { validateMessages, getValidationError } from './validation.js';
import { stringToContentV2 } from './utils.js';
import type { MastraDBMessage } from '@mastra/core/agent/message-list';

describe('validation', () => {
    const createValidMessage = (): MastraDBMessage => ({
        id: 'msg-1',
        role: 'user',
        content: stringToContentV2('Hello'),
        createdAt: new Date(),
    });

    describe('validateMessages', () => {
        it('should validate valid message array', () => {
            const messages = [createValidMessage()];
            expect(validateMessages(messages)).toBe(true);
        });

        it('should reject non-array values', () => {
            expect(validateMessages(null)).toBe(false);
            expect(validateMessages(undefined)).toBe(false);
            expect(validateMessages('not an array')).toBe(false);
            expect(validateMessages({})).toBe(false);
        });

        it('should reject empty arrays', () => {
            expect(validateMessages([])).toBe(false);
        });

        it('should reject messages missing id', () => {
            const msg = createValidMessage();
            delete (msg as any).id;
            expect(validateMessages([msg])).toBe(false);
        });

        it('should reject messages with invalid role', () => {
            const msg = createValidMessage();
            (msg as any).role = 'invalid';
            expect(validateMessages([msg])).toBe(false);
        });

        it('should reject messages missing content', () => {
            const msg = createValidMessage();
            delete (msg as any).content;
            expect(validateMessages([msg])).toBe(false);
        });

        it('should reject messages with invalid content format', () => {
            const msg = createValidMessage();
            (msg.content as any).format = 1;
            expect(validateMessages([msg])).toBe(false);
        });

        it('should reject messages with non-array parts', () => {
            const msg = createValidMessage();
            (msg.content as any).parts = 'not an array';
            expect(validateMessages([msg])).toBe(false);
        });

        it('should reject messages with invalid createdAt', () => {
            const msg = createValidMessage();
            (msg as any).createdAt = 'not a date';
            expect(validateMessages([msg])).toBe(false);
        });

        it('should validate multiple messages', () => {
            const messages = [createValidMessage(), createValidMessage()];
            expect(validateMessages(messages)).toBe(true);
        });

        it('should reject if any message is invalid', () => {
            const messages = [createValidMessage(), { invalid: 'message' } as any];
            expect(validateMessages(messages)).toBe(false);
        });
    });

    describe('getValidationError', () => {
        it('should return null for valid messages', () => {
            const messages = [createValidMessage()];
            expect(getValidationError(messages)).toBeNull();
        });

        it('should return error message for non-array', () => {
            expect(getValidationError(null)).toBe('Handler returned non-array value');
        });

        it('should return error message for empty array', () => {
            expect(getValidationError([])).toBe(
                'Handler returned empty array (should return undefined to skip)'
            );
        });

        it('should return error message for missing id', () => {
            const msg = createValidMessage();
            delete (msg as any).id;
            const error = getValidationError([msg]);
            expect(error).toContain('missing or invalid id');
        });

        it('should return error message for invalid role', () => {
            const msg = createValidMessage();
            (msg as any).role = 'invalid';
            const error = getValidationError([msg]);
            expect(error).toContain('invalid role');
        });
    });
});
