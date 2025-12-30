import { describe, it, expect } from 'bun:test';
import {
    getMessageText,
    estimateTokensDefault,
    shouldKeepMessage,
    stringToContentV2,
} from './utils.js';
import type { MastraDBMessage } from '@mastra/core/agent/message-list';

describe('utils', () => {
    describe('stringToContentV2', () => {
        it('should convert string to MastraMessageContentV2 format', () => {
            const result = stringToContentV2('Hello world');
            expect(result).toEqual({
                format: 2,
                parts: [{ type: 'text', text: 'Hello world' }],
            });
        });
    });

    describe('getMessageText', () => {
        it('should extract text from message with format 2', () => {
            const msg: MastraDBMessage = {
                id: '1',
                role: 'user',
                content: {
                    format: 2,
                    parts: [
                        { type: 'text', text: 'Hello' },
                        { type: 'text', text: ' world' },
                    ],
                },
                createdAt: new Date(),
            };
            expect(getMessageText(msg)).toBe('Hello world');
        });

        it('should handle non-text parts', () => {
            const msg: MastraDBMessage = {
                id: '1',
                role: 'user',
                content: {
                    format: 2,
                    parts: [
                        { type: 'text', text: 'Hello' },
                        { type: 'image', image: 'base64...' } as any,
                    ],
                },
                createdAt: new Date(),
            };
            const result = getMessageText(msg);
            expect(result).toContain('Hello');
            expect(result).toContain('image');
        });
    });

    describe('estimateTokensDefault', () => {
        it('should estimate tokens using char/4 approximation', () => {
            const messages: MastraDBMessage[] = [
                {
                    id: '1',
                    role: 'user',
                    content: stringToContentV2('Hello world'),
                    createdAt: new Date(),
                },
            ];
            // "Hello world" = 11 chars / 4 = 2.75 tokens
            expect(estimateTokensDefault(messages)).toBeCloseTo(2.75);
        });

        it('should sum tokens across multiple messages', () => {
            const messages: MastraDBMessage[] = [
                {
                    id: '1',
                    role: 'user',
                    content: stringToContentV2('Hello'),
                    createdAt: new Date(),
                },
                {
                    id: '2',
                    role: 'assistant',
                    content: stringToContentV2('World'),
                    createdAt: new Date(),
                },
            ];
            // "Hello" = 5 chars, "World" = 5 chars = 10 chars / 4 = 2.5 tokens
            expect(estimateTokensDefault(messages)).toBeCloseTo(2.5);
        });
    });

    describe('shouldKeepMessage', () => {
        const createMessage = (role: 'user' | 'assistant' | 'system'): MastraDBMessage => ({
            id: '1',
            role,
            content: stringToContentV2('test'),
            createdAt: new Date(),
        });

        it('should keep recent messages', () => {
            const msg = createMessage('assistant');
            const totalMessages = 10;
            const idx = 8; // Last 2 messages (idx >= 10 - 5 = 5)
            expect(shouldKeepMessage(msg, idx, totalMessages, { keepRecent: 5 })).toBe(true);
        });

        it('should not keep old messages', () => {
            const msg = createMessage('assistant');
            const totalMessages = 10;
            const idx = 0; // First message (not recent, not user/system)
            expect(
                shouldKeepMessage(msg, idx, totalMessages, {
                    keepRecent: 5,
                    keepUserMessages: false,
                    keepSystemMessages: false,
                })
            ).toBe(false);
        });

        it('should keep user messages when keepUserMessages is true', () => {
            const msg = createMessage('user');
            const totalMessages = 10;
            const idx = 0; // Old message
            expect(shouldKeepMessage(msg, idx, totalMessages, { keepUserMessages: true })).toBe(
                true
            );
        });

        it('should keep system messages when keepSystemMessages is true', () => {
            const msg = createMessage('system');
            const totalMessages = 10;
            const idx = 0; // Old message
            expect(shouldKeepMessage(msg, idx, totalMessages, { keepSystemMessages: true })).toBe(
                true
            );
        });

        it('should not keep user messages when keepUserMessages is false', () => {
            const msg = createMessage('user');
            const totalMessages = 10;
            const idx = 0; // Old message (not recent)
            expect(
                shouldKeepMessage(msg, idx, totalMessages, {
                    keepUserMessages: false,
                    keepRecent: 5,
                    keepSystemMessages: false,
                })
            ).toBe(false);
        });
    });
});
