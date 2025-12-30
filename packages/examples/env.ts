import 'dotenv/config';
import { createEnv } from '@t3-oss/env-core';
import { z } from 'zod';

export const env = createEnv({
    server: {
        ANTHROPIC_API_KEY: z.string().min(1),
    },
    runtimeEnv: process.env,
    emptyStringAsUndefined: true,
    onValidationError: error => {
        console.error('❌ Invalid environment variables:', error.flatten().fieldErrors);
        throw new Error('Invalid environment variables');
    },
    onInvalidAccess: key => {
        throw new Error(`Accessing invalid environment variable: ${key}`);
    },
});
