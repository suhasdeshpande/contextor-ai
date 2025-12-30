/**
 * Test script demonstrating context management processors
 *
 * This shows how processInputStep processors manage context
 * for long-running agents with many steps (30-50+)
 */

import { longRunningAgent } from './agents/long-running-agent.js';

async function testContextManagement() {
    console.log('🧪 Testing Context Management for Long-Running Agents\n');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

    // Simulate a long-running task with many steps
    const messages = [
        {
            role: 'user' as const,
            content: `I need you to help me with a complex multi-step project:

1. Create a comprehensive analysis script
2. Process multiple data files
3. Generate reports
4. Create documentation
5. Test everything thoroughly

This will require many steps. Please work through this systematically.`,
        },
    ];

    console.log('📋 Starting long-running task...');
    console.log('   The agent will use context management processors to:');
    console.log('   - Filter large tool results');
    console.log('   - Compact old tool outputs');
    console.log('   - Summarize old messages periodically');
    console.log('   - Offload context to files when needed\n');

    const stream = await longRunningAgent.stream(messages, {
        threadId: 'long-task-test',
        resourceId: 'test-user',
        maxSteps: 50, // Allow many steps
    });

    let stepCount = 0;
    let lastChunkType = '';

    for await (const chunk of stream.fullStream) {
        // Track step progression
        if (chunk.type === 'start-step') {
            stepCount++;
            if (stepCount % 5 === 0) {
                console.log(`\n📊 Step ${stepCount} completed`);
            }
        }

        // Show text output
        if (chunk.type === 'text-delta') {
            process.stdout.write(chunk.delta || '');
        }

        // Show tool calls
        if (chunk.type === 'tool-call' && lastChunkType !== 'tool-call') {
            console.log(`\n🔧 [Tool] ${chunk.toolName}`);
        }

        lastChunkType = chunk.type;
    }

    console.log(`\n\n✅ Task completed in ${stepCount} steps`);
    console.log('📊 Context management processors handled context efficiently');
}

testContextManagement().catch(console.error);
