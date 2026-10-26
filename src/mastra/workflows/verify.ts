/**
 * Disk-verification helpers used as a safety net around each agent step.
 *
 * The LLM may claim it wrote files when it didn't actually call the tool
 * (classic hallucination on weaker models). These checks fail the workflow
 * step loudly instead of letting it silently report "success" with no output.
 */
import { access, readdir, stat } from 'node:fs/promises';
import { resolve, join } from 'node:path';
import { REPO_ROOT } from '../paths.js';

async function exists(relPath: string): Promise<boolean> {
  try {
    await access(resolve(REPO_ROOT, relPath));
    return true;
  } catch {
    return false;
  }
}

async function countFiles(relDir: string, extension: string): Promise<number> {
  try {
    const abs = resolve(REPO_ROOT, relDir);
    const entries = await readdir(abs, { recursive: true });
    let n = 0;
    for (const e of entries) {
      if (typeof e === 'string' && e.toLowerCase().endsWith(extension.toLowerCase())) {
        const st = await stat(join(abs, e));
        if (st.isFile()) n++;
      }
    }
    return n;
  } catch {
    return 0;
  }
}

export async function verifyTestPlan(): Promise<void> {
  if (!(await exists('docs/01-test-plan.md'))) {
    throw new Error(
      'Hallucination guard: docs/01-test-plan.md was NOT written. ' +
        'The Brainstorm agent must call write-file before start-test-generation.',
    );
  }
}

export async function verifyArchitecture(): Promise<void> {
  if (!(await exists('docs/02-architecture.md'))) {
    throw new Error(
      'Hallucination guard: docs/02-architecture.md was NOT written. Architect agent failed to call write-file.',
    );
  }
}

export async function verifyUiSuite(): Promise<void> {
  const pageCount = await countFiles('MoxymindTests/Pages', '.cs');
  const specCount = await countFiles('MoxymindTests/Tests/UI', '.cs');
  if (pageCount === 0 || specCount === 0) {
    throw new Error(
      `Hallucination guard: dev-ui produced ${pageCount} Page Object classes and ${specCount} UI test classes. ` +
        'Expected at least 1 of each under MoxymindTests/Pages and MoxymindTests/Tests/UI.',
    );
  }
}

export async function verifyApiSuite(): Promise<void> {
  const specCount = await countFiles('MoxymindTests/Tests/API', '.cs');
  const csvOk = await exists('MoxymindTests/TestData/users.csv');
  if (specCount === 0 || !csvOk) {
    throw new Error(
      `Hallucination guard: dev-api produced ${specCount} API test classes (expected >=1) ` +
        `and MoxymindTests/TestData/users.csv ${csvOk ? 'OK' : 'MISSING'}.`,
    );
  }
}

export async function verifyBlindReview(): Promise<void> {
  if (!(await exists('docs/03-blind-review.md'))) {
    throw new Error(
      'Hallucination guard: docs/03-blind-review.md was NOT written. Blind-review agent failed to call write-file.',
    );
  }
}

export async function verifyReview(): Promise<void> {
  if (!(await exists('docs/03-review.md'))) {
    throw new Error(
      'Hallucination guard: docs/03-review.md was NOT written. Review agent failed to call write-file.',
    );
  }
}

export async function verifyReport(): Promise<void> {
  if (!(await exists('docs/README.md'))) {
    throw new Error(
      'Hallucination guard: docs/README.md was NOT written. Report agent failed to call write-file.',
    );
  }
}
