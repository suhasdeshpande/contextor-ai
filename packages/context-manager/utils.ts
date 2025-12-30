import type { MastraDBMessage, MastraMessageContentV2 } from '@mastra/core/agent/message-list';

/**
 * Convert string content to MastraMessageContentV2 format
 */
export function stringToContentV2(text: string): MastraMessageContentV2 {
    return {
        format: 2,
        parts: [{ type: 'text', text }],
    };
}

/**
 * Extract text content from MastraDBMessage
 */
export function getMessageText(msg: MastraDBMessage): string {
    if (msg.content.format === 2 && msg.content.parts) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-return
        return msg.content.parts
            .map((part: any) => (part.type === 'text' ? part.text : JSON.stringify(part)))
            .join('');
    }
    return JSON.stringify(msg.content);
}

/**
 * Default token estimation (rough approximation: 1 token ≈ 4 characters)
 * For production, use tiktoken via tokenCounter config option
 */
export function estimateTokensDefault(messages: MastraDBMessage[]): number {
    const totalChars = messages.reduce((sum, msg) => {
        return sum + getMessageText(msg).length;
    }, 0);
    return totalChars / 4;
}

/**
 * Check if a message should be kept based on retention rules
 */
export function shouldKeepMessage(
    msg: MastraDBMessage,
    idx: number,
    totalMessages: number,
    config: {
        keepRecent?: number;
        keepUserMessages?: boolean;
        keepSystemMessages?: boolean;
    }
): boolean {
    const isRecent = idx >= totalMessages - (config.keepRecent || 5);
    const isUser = config.keepUserMessages === true && msg.role === 'user';
    const isSystem = config.keepSystemMessages === true && msg.role === 'system';

    return isRecent || isUser || isSystem;
}
