import './env.js';
import { serve } from '@hono/node-server';
import { Hono } from 'hono';
import { toAISdkStream } from '@mastra/ai-sdk';
import { type HonoBindings, type HonoVariables, MastraServer } from '@mastra/hono';
import { mastra } from './mastra/index.js';

const app = new Hono<{ Bindings: HonoBindings; Variables: HonoVariables }>();
const server = new MastraServer({ app, mastra });

await server.init();

app.get('/', c => {
    return c.text('Hello Hono!');
});

app.post('/api/chat', async c => {
    try {
        const { messages, threadId, resourceId } = await c.req.json();

        const agent = mastra.getAgent('codeAgent');
        if (!agent) {
            return c.json({ error: 'Agent not found' }, 404);
        }

        const response = await agent.stream(messages, {
            threadId: threadId || 'default-thread',
            resourceId: resourceId || 'default-resource',
        });

        const aiSdkStream = toAISdkStream(response, {
            from: 'agent',
        });

        const encoder = new TextEncoder();
        const encodedStream = aiSdkStream.pipeThrough(
            new TransformStream({
                transform(chunk, controller) {
                    try {
                        const json = JSON.stringify(chunk);
                        controller.enqueue(encoder.encode(`0:${json}\n`));
                    } catch (error) {
                        controller.error(error);
                    }
                },
                flush(controller) {
                    controller.terminate();
                },
            })
        );

        return new Response(encodedStream, {
            headers: {
                'Content-Type': 'text/plain; charset=utf-8',
                'Cache-Control': 'no-cache',
                Connection: 'keep-alive',
            },
        });
    } catch (error: any) {
        console.error('Error in /api/chat:', error);
        return c.json({ error: error.message || 'Internal server error' }, 500);
    }
});

serve(
    {
        fetch: app.fetch,
        port: 3000,
    },
    info => {
        console.log(`Server is running on http://localhost:${info.port}`);
    }
);
