/**
 * Test script to explore prepareStep functionality
 *
 * This demonstrates:
 * 1. How prepareStep receives messages in MastraDBMessage format
 * 2. How to access AI SDK v5 format using messageList
 * 3. How to control tool choice based on message content
 */

import { prepareStepExampleAgent, prepareStepFunction } from './agents/prepare-step-example.js';

async function testPrepareStep() {
    console.log('🧪 Testing prepareStep with different scenarios\n');

    // Test 1: Simple message
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('Test 1: Simple user message');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

    const stream1 = await prepareStepExampleAgent.stream(
        [
            {
                role: 'user',
                content: 'Hello, can you help me?',
            },
        ],
        {
            threadId: 'test-thread-1',
            resourceId: 'test-resource',
            prepareStep: prepareStepFunction,
        }
    );

    // Consume the stream to trigger prepareStep
    for await (const chunk of stream1.fullStream) {
        if (chunk.type === 'text-delta') {
            process.stdout.write(chunk.delta || '');
        }
    }

    console.log('\n\n');

    // Test 2: Message requesting file write
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('Test 2: User wants to write a file');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

    const stream2 = await prepareStepExampleAgent.stream(
        [
            {
                role: 'user',
                content: 'Can you write a file called test.txt with some content?',
            },
        ],
        {
            threadId: 'test-thread-2',
            resourceId: 'test-resource',
            prepareStep: prepareStepFunction,
        }
    );

    for await (const chunk of stream2.fullStream) {
        if (chunk.type === 'text-delta') {
            process.stdout.write(chunk.delta || '');
        } else if (chunk.type === 'tool-call') {
            console.log('\n🔧 Tool called:', chunk.toolName);
        }
    }

    console.log('\n\n');

    // Test 3: Multi-turn conversation
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('Test 3: Multi-turn conversation');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

    const stream3 = await prepareStepExampleAgent.stream(
        [
            {
                role: 'user',
                content: 'What tools do you have?',
            },
            {
                role: 'assistant',
                content:
                    'I have tools to write files, read files, list files, and execute bash commands.',
            },
            {
                role: 'user',
                content: 'Great! Can you create a script for me?',
            },
        ],
        {
            threadId: 'test-thread-3',
            resourceId: 'test-resource',
            prepareStep: prepareStepFunction,
        }
    );

    for await (const chunk of stream3.fullStream) {
        if (chunk.type === 'text-delta') {
            process.stdout.write(chunk.delta || '');
        }
    }

    console.log('\n\n✅ All tests completed!');
}

testPrepareStep().catch(console.error);
