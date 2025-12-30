import { describe, it, expect, mock, beforeEach, spyOn } from 'bun:test';
import { createContextManager } from './index.js';
import { stringToContentV2 } from './utils.js';
import type { ProcessInputStepArgs } from '@mastra/core/processors';
import type { MastraDBMessage } from '@mastra/core/agent/message-list';

describe('createContextManager', () => {
    const createMockArgs = (
        stepNumber: number,
        messages: MastraDBMessage[]
    ): ProcessInputStepArgs => ({
        messages,
        messageList: {} as any,
        stepNumber,
        steps: [],
        systemMessages: [],
        model: 'anthropic/claude-sonnet-4-5',
        abort: () => {
            throw new Error('Aborted');
        },
        tracingContext: undefined,
        requestContext: undefined,
        retryCount: 0,
    });

    const createMessage = (
        id: string,
        role: 'user' | 'assistant' | 'system',
        content: string
    ): MastraDBMessage => ({
        id,
        role,
        content: stringToContentV2(content),
        createdAt: new Date(),
    });

    beforeEach(() => {
        mock.restore();
    });

    describe('basic functionality', () => {
        it('should create a processor', () => {
            const { processor } = createContextManager();
            expect(processor).toBeDefined();
            expect(processor.id).toBe('context-manager');
        });

        it('should return undefined when no strategies apply', async () => {
            const { processor } = createContextManager({
                handlers: {},
            });
            const args = createMockArgs(1, [createMessage('1', 'user', 'Hello')]);
            const result = await processor.processInputStep?.(args);
            expect(result).toBeUndefined();
        });
    });

    describe('beforeProcess hook', () => {
        it('should skip processing when beforeProcess returns false', async () => {
            const { processor } = createContextManager({
                hooks: {
                    beforeProcess: async () => false,
                },
                handlers: {
                    filter: async () => [createMessage('1', 'user', 'filtered')],
                },
            });
            const args = createMockArgs(10, [createMessage('1', 'user', 'Hello')]);
            const result = await processor.processInputStep?.(args);
            expect(result).toBeUndefined();
        });

        it('should continue when beforeProcess returns true', async () => {
            const filterHandler = mock(() =>
                Promise.resolve([createMessage('1', 'user', 'filtered')])
            );
            const { processor } = createContextManager({
                hooks: {
                    beforeProcess: async () => true,
                },
                handlers: {
                    filter: filterHandler,
                },
                thresholds: { filter: 0 }, // Low threshold to trigger
            });
            const args = createMockArgs(10, [createMessage('1', 'user', 'Hello')]);
            await processor.processInputStep?.(args);
            expect(filterHandler).toHaveBeenCalled();
        });

        it('should handle beforeProcess throwing', async () => {
            const onError = mock(() => Promise.resolve(false));
            const { processor } = createContextManager({
                hooks: {
                    beforeProcess: async () => {
                        throw new Error('beforeProcess error');
                    },
                    onError,
                },
            });
            const args = createMockArgs(1, [createMessage('1', 'user', 'Hello')]);
            const result = await processor.processInputStep?.(args);
            expect(result).toBeUndefined();
        });
    });

    describe('filter strategy', () => {
        it('should call filter handler when threshold exceeded', async () => {
            const filterHandler = mock(() =>
                Promise.resolve([createMessage('1', 'user', 'filtered')])
            );
            const { processor } = createContextManager({
                handlers: {
                    filter: filterHandler,
                },
                thresholds: { filter: 1 }, // Low threshold
                tokenCounter: async () => 1000, // High token count
            });
            const args = createMockArgs(1, [createMessage('1', 'user', 'Hello')]);
            await processor.processInputStep?.(args);
            expect(filterHandler).toHaveBeenCalled();
        });

        it('should not call filter handler when threshold not exceeded', async () => {
            const filterHandler = mock(() => Promise.resolve([]));
            const { processor } = createContextManager({
                handlers: {
                    filter: filterHandler,
                },
                thresholds: { filter: 10000 },
                tokenCounter: async () => 100, // Low token count
            });
            const args = createMockArgs(1, [createMessage('1', 'user', 'Hello')]);
            await processor.processInputStep?.(args);
            expect(filterHandler).not.toHaveBeenCalled();
        });

        it('should handle filter handler returning undefined', async () => {
            const filterHandler = mock(() => Promise.resolve(undefined));
            const { processor } = createContextManager({
                handlers: {
                    filter: filterHandler,
                },
                thresholds: { filter: 1 },
                tokenCounter: async () => 1000,
            });
            const args = createMockArgs(1, [createMessage('1', 'user', 'Hello')]);
            const result = await processor.processInputStep?.(args);
            expect(result).toBeUndefined();
        });

        it('should handle filter handler throwing', async () => {
            const onError = mock(() => Promise.resolve(true));
            const filterHandler = mock(() => Promise.reject(new Error('Filter error')));
            const { processor } = createContextManager({
                handlers: {
                    filter: filterHandler,
                },
                hooks: {
                    onError,
                },
                thresholds: { filter: 1 },
                tokenCounter: async () => 1000,
            });
            const args = createMockArgs(1, [createMessage('1', 'user', 'Hello')]);
            const result = await processor.processInputStep?.(args);
            expect(onError).toHaveBeenCalled();
            expect(result).toBeUndefined(); // Should continue with original messages
        });
    });

    describe('compact strategy', () => {
        it('should call compact handler when threshold exceeded and min steps met', async () => {
            const compactHandler = mock(() =>
                Promise.resolve([createMessage('1', 'user', 'compacted')])
            );
            const { processor } = createContextManager({
                handlers: {
                    compact: compactHandler,
                },
                thresholds: { compact: 1 },
                stepTriggers: { minStepsForCompact: 5 },
                tokenCounter: async () => 1000,
            });
            const args = createMockArgs(10, [createMessage('1', 'user', 'Hello')]);
            await processor.processInputStep?.(args);
            expect(compactHandler).toHaveBeenCalled();
        });

        it('should not call compact handler when min steps not met', async () => {
            const compactHandler = mock(() => Promise.resolve([]));
            const { processor } = createContextManager({
                handlers: {
                    compact: compactHandler,
                },
                thresholds: { compact: 1 },
                stepTriggers: { minStepsForCompact: 10 },
                tokenCounter: async () => 1000,
            });
            const args = createMockArgs(5, [createMessage('1', 'user', 'Hello')]);
            await processor.processInputStep?.(args);
            expect(compactHandler).not.toHaveBeenCalled();
        });
    });

    describe('summarize strategy', () => {
        it('should call summarize handler when step is multiple of summarizeEvery', async () => {
            const summarizeHandler = mock(() =>
                Promise.resolve([
                    createMessage('summary', 'system', 'Summary'),
                    createMessage('1', 'user', 'Recent'),
                ])
            );
            const { processor } = createContextManager({
                handlers: {
                    summarize: summarizeHandler,
                },
                thresholds: { summarize: 1 },
                stepTriggers: { summarizeEvery: 20 },
                retention: { keepRecent: 2 },
                tokenCounter: async () => 1000,
            });
            const messages = [
                createMessage('1', 'user', 'Old 1'),
                createMessage('2', 'user', 'Old 2'),
                createMessage('3', 'user', 'Recent 1'),
                createMessage('4', 'user', 'Recent 2'),
            ];
            const args = createMockArgs(20, messages);
            await processor.processInputStep?.(args);
            expect(summarizeHandler).toHaveBeenCalled();
            const callArgs = summarizeHandler.mock.calls[0][0];
            expect(callArgs.oldMessages).toHaveLength(2);
            expect(callArgs.recentMessages).toHaveLength(2);
        });

        it('should not call summarize handler when step is not multiple', async () => {
            const summarizeHandler = mock(() => Promise.resolve([]));
            const { processor } = createContextManager({
                handlers: {
                    summarize: summarizeHandler,
                },
                stepTriggers: { summarizeEvery: 20 },
                tokenCounter: async () => 1000,
            });
            const args = createMockArgs(19, [createMessage('1', 'user', 'Hello')]);
            await processor.processInputStep?.(args);
            expect(summarizeHandler).not.toHaveBeenCalled();
        });
    });

    describe('offload strategy', () => {
        it('should call offload handler with correct message split', async () => {
            const offloadHandler = mock(() =>
                Promise.resolve([
                    createMessage('1', 'user', 'Kept'),
                    createMessage('ref', 'system', 'Offloaded reference'),
                ])
            );
            const { processor } = createContextManager({
                handlers: {
                    offload: offloadHandler,
                },
                thresholds: { offload: 1 },
                stepTriggers: { minStepsForOffload: 5 },
                retention: { keepRecent: 2, keepUserMessages: true },
                tokenCounter: async () => 1000,
            });
            const messages = [
                createMessage('1', 'user', 'Old user'), // Should keep (user)
                createMessage('2', 'assistant', 'Old assistant'), // Should offload
                createMessage('3', 'assistant', 'Recent 1'), // Should keep (recent)
                createMessage('4', 'assistant', 'Recent 2'), // Should keep (recent)
            ];
            const args = createMockArgs(10, messages);
            await processor.processInputStep?.(args);
            expect(offloadHandler).toHaveBeenCalled();
            const callArgs = offloadHandler.mock.calls[0][0];
            expect(callArgs.messagesToKeep.length).toBeGreaterThan(0);
            expect(callArgs.messagesToOffload.length).toBeGreaterThan(0);
        });
    });

    describe('shouldRunStrategy hook', () => {
        it('should skip strategy when shouldRunStrategy returns false', async () => {
            const filterHandler = mock(() => Promise.resolve([]));
            const { processor } = createContextManager({
                handlers: {
                    filter: filterHandler,
                },
                hooks: {
                    shouldRunStrategy: async () => false,
                },
                thresholds: { filter: 1 },
                tokenCounter: async () => 1000,
            });
            const args = createMockArgs(1, [createMessage('1', 'user', 'Hello')]);
            await processor.processInputStep?.(args);
            expect(filterHandler).not.toHaveBeenCalled();
        });
    });

    describe('validation', () => {
        it('should validate handler return values', async () => {
            const onValidationError = mock(() => Promise.resolve(true));
            const filterHandler = mock(() => Promise.resolve([{ invalid: 'message' }] as any));
            const { processor } = createContextManager({
                handlers: {
                    filter: filterHandler,
                },
                hooks: {
                    onValidationError,
                },
                thresholds: { filter: 1 },
                tokenCounter: async () => 1000,
                validateHandlers: true,
            });
            const args = createMockArgs(1, [createMessage('1', 'user', 'Hello')]);
            const result = await processor.processInputStep?.(args);
            expect(onValidationError).toHaveBeenCalled();
            expect(result).toBeUndefined(); // Should skip invalid handler result
        });

        it('should skip validation when validateHandlers is false', async () => {
            const filterHandler = mock(() => Promise.resolve([{ invalid: 'message' }] as any));
            const { processor } = createContextManager({
                handlers: {
                    filter: filterHandler,
                },
                thresholds: { filter: 1 },
                tokenCounter: async () => 1000,
                validateHandlers: false,
            });
            const args = createMockArgs(1, [createMessage('1', 'user', 'Hello')]);
            const result = await processor.processInputStep?.(args);
            // Should proceed without validation
            expect(result).toBeDefined();
        });
    });

    describe('afterModify hook', () => {
        it('should call afterModify after successful handler', async () => {
            const afterModify = mock((args: any, messages: any) => messages);
            const filterHandler = mock(() =>
                Promise.resolve([createMessage('1', 'user', 'filtered')])
            );
            const { processor } = createContextManager({
                handlers: {
                    filter: filterHandler,
                },
                hooks: {
                    afterModify,
                },
                thresholds: { filter: 1 },
                tokenCounter: async () => 1000,
            });
            const args = createMockArgs(1, [createMessage('1', 'user', 'Hello')]);
            await processor.processInputStep?.(args);
            expect(afterModify).toHaveBeenCalled();
        });

        it('should handle afterModify throwing', async () => {
            const onError = mock(() => Promise.resolve(true));
            const afterModify = mock(() => {
                throw new Error('afterModify error');
            });
            const filterHandler = mock(() =>
                Promise.resolve([createMessage('1', 'user', 'filtered')])
            );
            const { processor } = createContextManager({
                handlers: {
                    filter: filterHandler,
                },
                hooks: {
                    afterModify,
                    onError,
                },
                thresholds: { filter: 1 },
                tokenCounter: async () => 1000,
            });
            const args = createMockArgs(1, [createMessage('1', 'user', 'Hello')]);
            const result = await processor.processInputStep?.(args);
            expect(onError).toHaveBeenCalled();
            // Should rollback to original messages (no changes applied)
            expect(result).toBeUndefined();
        });
    });

    describe('tokenCounter', () => {
        it('should use custom tokenCounter when provided', async () => {
            const customCounter = mock(() => Promise.resolve(5000));
            const { processor } = createContextManager({
                tokenCounter: customCounter,
                handlers: {
                    filter: async () => [createMessage('1', 'user', 'filtered')],
                },
                thresholds: { filter: 1000 },
            });
            const args = createMockArgs(1, [createMessage('1', 'user', 'Hello')]);
            await processor.processInputStep?.(args);
            expect(customCounter).toHaveBeenCalled();
        });

        it('should pass model to tokenCounter', async () => {
            const customCounter = mock(() => Promise.resolve(100));
            const { processor } = createContextManager({
                tokenCounter: customCounter,
            });
            const args = createMockArgs(1, [createMessage('1', 'user', 'Hello')]);
            args.model = 'gpt-4';
            await processor.processInputStep?.(args);
            expect(customCounter).toHaveBeenCalledWith(expect.any(Array), 'gpt-4');
        });
    });

    describe('strategy enable/disable', () => {
        it('should not call handler when strategy is disabled', async () => {
            const filterHandler = mock(() => Promise.resolve([]));
            const { processor } = createContextManager({
                handlers: {
                    filter: filterHandler,
                },
                strategies: {
                    filter: false,
                },
                thresholds: { filter: 1 },
                tokenCounter: async () => 1000,
            });
            const args = createMockArgs(1, [createMessage('1', 'user', 'Hello')]);
            await processor.processInputStep?.(args);
            expect(filterHandler).not.toHaveBeenCalled();
        });
    });

    describe('multiple strategies', () => {
        it('should apply strategies in order', async () => {
            const filterHandler = mock(() =>
                Promise.resolve([createMessage('1', 'user', 'filtered')])
            );
            const compactHandler = mock(() =>
                Promise.resolve([createMessage('1', 'user', 'compacted')])
            );
            const afterModify = mock((args: any, messages: any) => messages);
            const { processor } = createContextManager({
                handlers: {
                    filter: filterHandler,
                    compact: compactHandler,
                },
                hooks: {
                    afterModify,
                },
                thresholds: { filter: 1, compact: 1 },
                stepTriggers: { minStepsForCompact: 1 },
                tokenCounter: async () => 1000,
            });
            const args = createMockArgs(10, [createMessage('1', 'user', 'Hello')]);
            await processor.processInputStep?.(args);
            expect(filterHandler).toHaveBeenCalled();
            expect(compactHandler).toHaveBeenCalled();
            expect(afterModify.mock.calls.length).toBeGreaterThanOrEqual(2); // At least once per strategy
        });
    });

    describe('edge cases', () => {
        it('should handle summarize when no old messages', async () => {
            const summarizeHandler = mock(() => Promise.resolve([]));
            const { processor } = createContextManager({
                handlers: {
                    summarize: summarizeHandler,
                },
                stepTriggers: { summarizeEvery: 20 },
                retention: { keepRecent: 10 },
                tokenCounter: async () => 1000,
            });
            // Only 5 messages, all are "recent"
            const messages = Array.from({ length: 5 }, (_, i) =>
                createMessage(`${i}`, 'user', `Message ${i}`)
            );
            const args = createMockArgs(20, messages);
            await processor.processInputStep?.(args);
            expect(summarizeHandler).not.toHaveBeenCalled();
        });

        it('should handle offload when no messages to offload', async () => {
            const offloadHandler = mock(() => Promise.resolve([]));
            const { processor } = createContextManager({
                handlers: {
                    offload: offloadHandler,
                },
                thresholds: { offload: 1 },
                stepTriggers: { minStepsForOffload: 5 },
                retention: { keepRecent: 100 }, // Keep all messages
                tokenCounter: async () => 1000,
            });
            const messages = [createMessage('1', 'user', 'Hello')];
            const args = createMockArgs(10, messages);
            await processor.processInputStep?.(args);
            expect(offloadHandler).not.toHaveBeenCalled();
        });

        it('should handle handler returning empty array (invalid)', async () => {
            const onValidationError = mock(() => Promise.resolve(true));
            const filterHandler = mock(() => Promise.resolve([]));
            const { processor } = createContextManager({
                handlers: {
                    filter: filterHandler,
                },
                hooks: {
                    onValidationError,
                },
                thresholds: { filter: 1 },
                tokenCounter: async () => 1000,
                validateHandlers: true,
            });
            const args = createMockArgs(1, [createMessage('1', 'user', 'Hello')]);
            const result = await processor.processInputStep?.(args);
            expect(onValidationError).toHaveBeenCalled();
            expect(result).toBeUndefined();
        });

        it('should handle onError returning false (abort)', async () => {
            const onError = mock(() => Promise.resolve(false));
            const filterHandler = mock(() => Promise.reject(new Error('Handler error')));
            const { processor } = createContextManager({
                handlers: {
                    filter: filterHandler,
                },
                hooks: {
                    onError,
                },
                thresholds: { filter: 1 },
                tokenCounter: async () => 1000,
            });
            const args = createMockArgs(1, [createMessage('1', 'user', 'Hello')]);
            const result = await processor.processInputStep?.(args);
            expect(onError).toHaveBeenCalled();
            expect(result).toBeUndefined();
        });

        it('should handle onValidationError returning false (abort)', async () => {
            const onValidationError = mock(() => Promise.resolve(false));
            const filterHandler = mock(() => Promise.resolve([{ invalid: 'message' }] as any));
            const { processor } = createContextManager({
                handlers: {
                    filter: filterHandler,
                },
                hooks: {
                    onValidationError,
                },
                thresholds: { filter: 1 },
                tokenCounter: async () => 1000,
                validateHandlers: true,
            });
            const args = createMockArgs(1, [createMessage('1', 'user', 'Hello')]);
            const result = await processor.processInputStep?.(args);
            expect(onValidationError).toHaveBeenCalled();
            expect(result).toBeUndefined();
        });

        it('should use default tokenCounter when not provided', async () => {
            const { processor } = createContextManager({
                handlers: {},
            });
            const args = createMockArgs(1, [createMessage('1', 'user', 'Hello world')]);
            // Should not throw - uses default char/4 estimation
            const result = await processor.processInputStep?.(args);
            expect(result).toBeUndefined(); // No strategies apply, so undefined
        });
    });
});
