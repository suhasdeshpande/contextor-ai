import { Mastra } from '@mastra/core/mastra';
import { PinoLogger } from '@mastra/loggers';
import { LibSQLStore } from '@mastra/libsql';
import { Observability } from '@mastra/observability';
import { codeAgent } from '../agents/code-agent.js';

export const mastra = new Mastra({
    agents: { codeAgent },
    storage: new LibSQLStore({
        id: 'mastra-storage',
        // stores observability, scores, ... into memory storage, if it needs to persist, change to file:../mastra.db
        url: ':memory:',
    }),
    logger: new PinoLogger({
        name: 'Mastra',
        level: 'info',
    }),
    observability: new Observability({
        // Enables DefaultExporter and CloudExporter for tracing
        default: { enabled: true },
    }),
});
