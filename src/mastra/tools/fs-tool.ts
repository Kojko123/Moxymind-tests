/**
 * Sandboxed filesystem tools for agents.
 *
 * writeFile — writes to:
 *             - docs/**  (markdown artifacts)
 *             - MoxymindTests/Pages/**, MoxymindTests/Tests/**, MoxymindTests/Helpers/**,
 *               MoxymindTests/TestData/**, MoxymindTests/Schemas/**  (C# suite)
 *             EXCEPT anything inside a MoxymindTests/Tests/<Project>/Manual/ folder,
 *             which is reserved for the human's hand-written tests.
 *             The .csproj file is NEVER writable.
 * readFile  — reads any file within the repo so the Review agent can inspect what Dev agents produced.
 */
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';
import { mkdir, writeFile as fsWriteFile, readFile as fsReadFile } from 'node:fs/promises';
import { dirname, resolve, relative, sep } from 'node:path';
import { REPO_ROOT } from '../paths.js';

// Each entry is a path prefix under REPO_ROOT where agents may write.
const WRITE_ALLOWLIST_PREFIXES = [
  'docs',
  'MoxymindTests/Pages',
  'MoxymindTests/Tests',
  'MoxymindTests/Helpers',
  'MoxymindTests/TestData',
  'MoxymindTests/Schemas',
];

function isUnderAllowlist(absPath: string): boolean {
  const rel = relative(REPO_ROOT, absPath).replaceAll(sep, '/');
  if (rel.startsWith('../') || rel.startsWith('/')) return false;
  // Humans-only zone: anything inside Manual/ under MoxymindTests/Tests/ is off-limits.
  if (/^MoxymindTests\/Tests\/[^/]+\/Manual\//i.test(rel)) return false;
  // Project file is never writable (even though it's under MoxymindTests/).
  if (rel.endsWith('.csproj') || rel.endsWith('.sln')) return false;
  return WRITE_ALLOWLIST_PREFIXES.some((p) => rel === p || rel.startsWith(`${p}/`));
}

export const writeFileTool = createTool({
  id: 'write-file',
  description:
    'Write a file to the project. Allowed paths: docs/**, MoxymindTests/Pages/**, ' +
    'MoxymindTests/Tests/**, MoxymindTests/Helpers/**, MoxymindTests/TestData/**, ' +
    'MoxymindTests/Schemas/**. Any path containing a "Manual/" segment under ' +
    'MoxymindTests/Tests/ is reserved for the human. The .csproj file is never writable. ' +
    'Use relative paths from the repo root, e.g. "MoxymindTests/Pages/LoginPage.cs".',
  inputSchema: z.object({
    path: z.string().describe('Relative path from repo root (e.g. tests/ui/login.spec.ts)'),
    content: z.string().describe('Full file contents to write'),
  }),
  outputSchema: z.object({
    ok: z.boolean(),
    path: z.string(),
    bytes: z.number(),
  }),
  execute: async (input) => {
    const abs = resolve(REPO_ROOT, input.path);
    if (!isUnderAllowlist(abs)) {
      throw new Error(
        `Refused: ${input.path} is outside the allowlist (${WRITE_ALLOWLIST_PREFIXES.join(', ')}). ` +
          'Note: MoxymindTests/**/Manual/ is reserved for the human; .csproj is read-only.',
      );
    }
    await mkdir(dirname(abs), { recursive: true });
    await fsWriteFile(abs, input.content, 'utf8');
    return { ok: true, path: input.path, bytes: Buffer.byteLength(input.content, 'utf8') };
  },
});

export const readFileTool = createTool({
  id: 'read-file',
  description: 'Read a file from the project. Use relative paths from the repo root.',
  inputSchema: z.object({
    path: z.string().describe('Relative path from repo root'),
  }),
  outputSchema: z.object({
    path: z.string(),
    content: z.string(),
  }),
  execute: async (input) => {
    const abs = resolve(REPO_ROOT, input.path);
    const rel = relative(REPO_ROOT, abs);
    if (rel.startsWith('..') || rel.startsWith(sep)) {
      throw new Error(`Refused: ${input.path} is outside the repo`);
    }
    const content = await fsReadFile(abs, 'utf8');
    return { path: input.path, content };
  },
});
