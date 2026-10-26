/**
 * Pre-regeneration cleanup.
 *
 * The architect step calls this BEFORE any dev agent runs. It wipes every
 * agent-produced artifact so each workflow run starts from a known-clean
 * state — preventing stale orphans when the architect decides on a different
 * file layout between runs.
 *
 * ALWAYS PRESERVED:
 *   - MoxymindTests/Tests/<project>/Manual/ subtrees  (your hand-written tests)
 *   - MoxymindTests/MoxymindTests.csproj              (the project file)
 *   - docs/01-test-plan.md                            (your approved plan)
 *   - everything outside the deletion scope (config, src/mastra, etc.)
 */
import { readdir, rm, stat } from 'node:fs/promises';
import { resolve, join } from 'node:path';
import { REPO_ROOT } from '../paths.js';

/**
 * Delete every file matching the given extension inside relRoot (recursive),
 * skipping any directory called 'Manual' (reserved for the human).
 * Also removes resulting empty directories.
 */
async function wipeByExtensionRecursive(relRoot: string, extension: string): Promise<number> {
  const abs = resolve(REPO_ROOT, relRoot);
  let deleted = 0;
  let entries: string[];
  try {
    entries = await readdir(abs);
  } catch {
    return 0;
  }
  for (const name of entries) {
    if (name === 'Manual') continue;
    const full = join(abs, name);
    const st = await stat(full).catch(() => null);
    if (!st) continue;
    if (st.isDirectory()) {
      deleted += await wipeByExtensionRecursive(join(relRoot, name), extension);
      const remaining = await readdir(full).catch(() => []);
      if (remaining.length === 0) {
        await rm(full, { recursive: false }).catch(() => undefined);
      }
    } else if (st.isFile() && name.toLowerCase().endsWith(extension.toLowerCase())) {
      await rm(full);
      deleted++;
    }
  }
  return deleted;
}

async function wipeExact(paths: string[]): Promise<number> {
  let deleted = 0;
  for (const p of paths) {
    const abs = resolve(REPO_ROOT, p);
    try {
      await rm(abs);
      deleted++;
    } catch {
      /* already gone — fine */
    }
  }
  return deleted;
}

export async function cleanupBeforeRegen(): Promise<{ deleted: number }> {
  const [pages, uiTests, apiTests, helpers, csvFiles, schemas, docs] = await Promise.all([
    wipeByExtensionRecursive('MoxymindTests/Pages', '.cs'),
    wipeByExtensionRecursive('MoxymindTests/Tests/UI', '.cs'),
    wipeByExtensionRecursive('MoxymindTests/Tests/API', '.cs'),
    wipeByExtensionRecursive('MoxymindTests/Helpers', '.cs'),
    wipeByExtensionRecursive('MoxymindTests/TestData', '.csv'),
    wipeByExtensionRecursive('MoxymindTests/Schemas', '.json'),
    wipeExact([
      'docs/02-architecture.md',
      'docs/03-review.md',
      'docs/03-blind-review.md',
      'docs/README.md',
    ]),
  ]);
  const total = pages + uiTests + apiTests + helpers + csvFiles + schemas + docs;
  console.log(
    `[cleanup] wiped ${total} files (pages:${pages} ui-tests:${uiTests} api-tests:${apiTests} ` +
      `helpers:${helpers} csv:${csvFiles} schemas:${schemas} docs:${docs}) — Manual/ preserved`,
  );
  return { deleted: total };
}
