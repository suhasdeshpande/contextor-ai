import { Agent } from '@mastra/core/agent';
import { Memory } from '@mastra/memory';
import type { ProcessInputStepArgs, ProcessInputStepResult } from '@mastra/core/processors';
import type { MastraDBMessage } from '@mastra/core/agent/message-list';
import {
    writeFileTool,
    readFileTool,
    listFilesTool,
    executeBashTool,
} from '../tools/bash-tools.js';

/**
 * Example demonstrating prepareStep with the new MastraDBMessage format
 *
 * According to the migration guide:
 * - prepareStep now receives messages in MastraDBMessage format (not AI SDK v5 format)
 * - Use messageList.get.all.aiV5.model() if you need the old AI SDK v5 format
 * - This unifies prepareStep with processInputStep processor method
 *
 * NOTE: prepareStep is passed to stream()/generate() options, not Agent constructor
 */

export const prepareStepExampleAgent = new Agent({
    id: 'prepare-step-example',
    name: 'Prepare Step Example Agent',
    instructions: 'You are a helpful assistant that demonstrates prepareStep functionality.',
    model: 'anthropic/claude-sonnet-4-5',
    tools: {
        writeFile: writeFileTool,
        readFile: readFileTool,
        listFiles: listFilesTool,
        executeBash: executeBashTool,
    },
    memory: new Memory(),
});

/**
 * prepareStep function - pass this to agent.stream() or agent.generate() options
 *
 * prepareStep is called before each step in the agentic loop
 * It allows you to:
 * - Inspect/modify messages before they're sent to the LLM
 * - Control tool choice behavior
 * - Add custom logic based on message history
 */
export const prepareStepFunction = async (
    args: ProcessInputStepArgs
): Promise<ProcessInputStepResult | undefined> => {
    const { messages, messageList, stepNumber, tools } = args;
    console.log('\n=== prepareStep called ===');

    // 1. Messages are now in MastraDBMessage format
    console.log('\n📨 Messages (MastraDBMessage format):');
    console.log('Total messages:', messages.length);

    // MastraDBMessage format structure:
    // {
    //   id: string,
    //   role: 'user' | 'assistant' | 'system' | 'tool',
    //   content: string | Array<{ type: string, ... }>,
    //   createdAt: Date,
    //   metadata?: Record<string, any>
    // }

    messages.forEach((msg: MastraDBMessage, idx: number) => {
        console.log(`\nMessage ${idx + 1}:`);
        console.log('  - ID:', msg.id);
        console.log('  - Role:', msg.role);

        // Handle content - can be string or array
        const contentStr =
            typeof msg.content === 'string' ? msg.content : JSON.stringify(msg.content);
        console.log('  - Content type:', typeof msg.content === 'string' ? 'string' : 'array');
        if (typeof msg.content === 'string') {
            console.log('  - Content preview:', contentStr.slice(0, 100) + '...');
        } else {
            console.log(
                '  - Content parts:',
                Array.isArray(msg.content) ? msg.content.length : 'unknown'
            );
        }
    });

    // 2. If you need AI SDK v5 format (old format), use messageList
    console.log('\n📋 Getting AI SDK v5 format (if needed):');
    const aiSdkV5Messages = messageList.get.all.aiV5.model();
    console.log('AI SDK v5 messages count:', aiSdkV5Messages.length);

    // AI SDK v5 format structure:
    // {
    //   role: 'user' | 'assistant' | 'system' | 'tool',
    //   content: string | Array<{ type: string, ... }>
    // }

    if (aiSdkV5Messages.length > 0) {
        const firstMessage = aiSdkV5Messages[0];
        console.log('First AI SDK v5 message role:', firstMessage.role);
        console.log(
            'First AI SDK v5 message content type:',
            typeof firstMessage.content === 'string' ? 'string' : 'array'
        );
    }

    // 3. Example: Custom logic based on message history
    const lastMessage = messages[messages.length - 1];
    const lastContent =
        typeof lastMessage.content === 'string'
            ? lastMessage.content
            : JSON.stringify(lastMessage.content);
    const isUserAskingForHelp = lastContent.toLowerCase().includes('help');

    if (isUserAskingForHelp) {
        console.log('\n💡 User is asking for help - enabling all tools');
        // Return options to control the step
        return {
            toolChoice: 'auto', // Allow agent to use any tool
        };
    }

    // 4. Example: Force specific tool usage based on message content
    const wantsToWriteFile =
        lastContent.toLowerCase().includes('write') ||
        lastContent.toLowerCase().includes('create') ||
        lastContent.toLowerCase().includes('save');

    if (wantsToWriteFile) {
        console.log('\n📝 User wants to write a file - ensuring writeFile tool is available');
        return {
            toolChoice: {
                type: 'tool',
                toolName: 'writeFile',
            },
        };
    }

    // 5. Example: Logging and monitoring
    console.log('\n📊 Step metadata:');
    console.log('  - Thread messages:', messages.length);
    console.log('  - Last message role:', lastMessage.role);

    // Default: let the agent decide
    return {
        toolChoice: 'auto',
    };
};
