/**
 * Resolve the real project root at module load.
 *
 * Mastra's bundled dev server runs with process.cwd() pointing at its output
 * directory, not the repo root. Walking up from this file to the nearest
 * package.json anchors every file read/write to the actual project directory
 * regardless of how/where the server was started.
 */
import { access } from 'node:fs/promises';
import { constants } from 'node:fs';
import { dirname, resolve, parse } from 'node:path';
import { fileURLToPath } from 'node:url';

async function findProjectRoot(): Promise<string> {
  let dir = dirname(fileURLToPath(import.meta.url));
  const { root } = parse(dir);
  while (dir !== root) {
    try {
      // Require BOTH markers: package.json AND src/mastra/ — this skips
      // Mastra's bundled .mastra/output/ (which has its own package.json)
      // and lands on the real repo root.
      await access(resolve(dir, 'package.json'), constants.F_OK);
      await access(resolve(dir, 'src', 'mastra'), constants.F_OK);
      return dir;
    } catch {
      dir = dirname(dir);
    }
  }
  return process.cwd();
}

export const REPO_ROOT = await findProjectRoot();
