export {};

const response = await fetch('http://localhost:3000/api/chat', {
    method: 'POST',
    headers: {
        'Content-Type': 'application/json',
    },
    body: JSON.stringify({
        messages: [
            {
                role: 'user',
                content: 'Write a bash script to list all files in a directory',
            },
        ],
        threadId: 'test-thread',
        resourceId: 'user-123',
    }),
});

if (!response.ok) {
    const error = await response.json();
    console.error('Error:', error);
    process.exit(1);
}

if (!response.body) {
    console.error('No response body');
    process.exit(1);
}

const reader = response.body.getReader();
const decoder = new TextDecoder();
let buffer = '';

try {
    while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const text = decoder.decode(value, { stream: true });
        buffer += text;

        // Process complete lines (AI SDK stream format uses newlines)
        const lines = buffer.split('\n');
        buffer = lines.pop() || ''; // Keep incomplete line in buffer

        for (const line of lines) {
            if (!line.trim()) continue;

            try {
                let chunk;

                // Try parsing as AI SDK format (0: prefix)
                if (line.startsWith('0:')) {
                    const jsonStr = line.slice(2);
                    chunk = JSON.parse(jsonStr);
                } else {
                    // Try parsing as direct JSON
                    chunk = JSON.parse(line);
                }

                if (chunk.type === 'text-delta') {
                    process.stdout.write(chunk.delta || chunk.textDelta || '');
                } else if (chunk.type === 'text') {
                    process.stdout.write(chunk.text || '');
                } else if (chunk.type === 'tool-call' || chunk.type === 'tool-input-start') {
                    if (chunk.type === 'tool-input-start') {
                        console.log('\n\n[Tool Call]', chunk.toolName);
                    }
                } else if (chunk.type === 'tool-result' || chunk.type === 'tool-output-available') {
                    if (chunk.type === 'tool-output-available') {
                        console.log('\n[Tool Result]');
                        if (chunk.output) {
                            console.log(JSON.stringify(chunk.output, null, 2));
                        }
                    }
                }
            } catch (e) {
                // Skip invalid JSON - might be partial chunk
            }
        }
    }
} finally {
    reader.releaseLock();
}

console.log('\n');
