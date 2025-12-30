import { createTool } from '@mastra/core/tools';
import { z } from 'zod';
import { writeFile, readFile, mkdir, readdir } from 'fs/promises';
import { join } from 'path';
import { tmpdir } from 'os';

const TEMP_DIR = join(tmpdir(), 'mastra-agent');

// Ensure temp directory exists
await mkdir(TEMP_DIR, { recursive: true });

export const writeFileTool = createTool({
    id: 'write-file',
    description:
        'Write content to a file in the temp directory. Use this to create or update files.',
    inputSchema: z.object({
        filename: z.string().describe('Name of the file (e.g., "example.txt", "script.sh")'),
        content: z.string().describe('Content to write to the file'),
    }),
    outputSchema: z.object({
        path: z.string(),
        success: z.boolean(),
    }),
    execute: async ({ filename, content }) => {
        const filePath = join(TEMP_DIR, filename);
        await writeFile(filePath, content, 'utf-8');
        return {
            path: filePath,
            success: true,
        };
    },
});

export const readFileTool = createTool({
    id: 'read-file',
    description: 'Read the contents of a file from the temp directory or any file path.',
    inputSchema: z.object({
        filename: z.string().describe('Name of the file in temp directory, or full path to file'),
        useFullPath: z
            .boolean()
            .optional()
            .describe(
                'If true, filename is treated as full path. If false, looks in temp directory.'
            ),
    }),
    outputSchema: z.object({
        content: z.string(),
        path: z.string(),
    }),
    execute: async ({ filename, useFullPath }) => {
        const filePath = useFullPath ? filename : join(TEMP_DIR, filename);
        const content = await readFile(filePath, 'utf-8');
        return {
            content,
            path: filePath,
        };
    },
});

export const listFilesTool = createTool({
    id: 'list-files',
    description: 'List all files in the temp directory or a specified directory.',
    inputSchema: z.object({
        directory: z
            .string()
            .optional()
            .describe('Directory path to list. If not provided, lists temp directory.'),
    }),
    outputSchema: z.object({
        files: z.array(z.string()),
        directory: z.string(),
    }),
    execute: async ({ directory }) => {
        const dir = directory || TEMP_DIR;
        const files = await readdir(dir);
        return {
            files,
            directory: dir,
        };
    },
});

export const executeBashTool = createTool({
    id: 'execute-bash',
    description:
        'Execute a bash command and return the output. Use this to run scripts, commands, etc.',
    inputSchema: z.object({
        command: z.string().describe('Bash command to execute'),
        workingDirectory: z
            .string()
            .optional()
            .describe('Working directory for the command. Defaults to temp directory.'),
    }),
    outputSchema: z.object({
        stdout: z.string(),
        stderr: z.string(),
        exitCode: z.number(),
    }),
    execute: async ({ command, workingDirectory }) => {
        const { exec } = await import('child_process');
        const { promisify } = await import('util');
        const execAsync = promisify(exec);

        const cwd = workingDirectory || TEMP_DIR;

        try {
            const { stdout, stderr } = await execAsync(command, {
                cwd,
                shell: '/bin/bash',
            });
            return {
                stdout: stdout || '',
                stderr: stderr || '',
                exitCode: 0,
            };
        } catch (error: any) {
            return {
                stdout: error.stdout || '',
                stderr: error.stderr || error.message || '',
                exitCode: error.code || 1,
            };
        }
    },
});
