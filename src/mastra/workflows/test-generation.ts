/**
 * test-generation workflow — runs AFTER the user has approved the test plan
 * by chatting with the brainstorm agent (gate #1: docs/01-test-plan.md exists).
 *
 * Pipeline (steps that are independent run in parallel):
 *
 *   architect
 *      ↓
 *   ┌─ dev-ui ─┐    ┌─ blind-review ─┐
 *   │           ├──→│                 ├──→ gate (human in-the-loop) ──→ report
 *   └─ dev-api ─┘    └─ review ──────┘
 *
 * The dev agents don't depend on each other; the two reviewers don't either
 * (compliance review reads plan + architecture + code; blind review reads only
 * code — both independently of the other). Running them in parallel cuts
 * ~30-60s per iteration.
 *
 * The gate step handles suspend/resume + the fix loop so the parallel pairs
 * can both complete deterministically before any human input is required.
 */
import { createWorkflow, createStep } from '@mastra/core/workflows';
import { z } from 'zod';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { architectAgent } from '../agents/architect.js';
import { devUiAgent } from '../agents/dev-ui.js';
import { devApiAgent } from '../agents/dev-api.js';
import { blindReviewAgent } from '../agents/blind-review.js';
import { reviewAgent } from '../agents/review.js';
import { reportAgent } from '../agents/report.js';
import { REPO_ROOT } from '../paths.js';
import {
  verifyArchitecture,
  verifyUiSuite,
  verifyApiSuite,
  verifyBlindReview,
  verifyReview,
  verifyReport,
} from './verify.js';
import { cleanupBeforeRegen } from './cleanup.js';

// Every intermediate step emits an empty object; downstream steps read any
// context they need from disk (docs/, pages/, tests/, data/). This keeps the
// output schemas trivially mergeable for Mastra's parallel execution.
const empty = z.object({});

/**
 * Extract strengths + issues (with severity tags) from a review-style markdown doc.
 */
async function parseReviewDoc(path: string): Promise<{
  strengthsCount: number;
  issues: Array<{ severity: string; text: string }>;
}> {
  let content: string;
  try {
    content = await readFile(resolve(REPO_ROOT, path), 'utf8');
  } catch {
    return { strengthsCount: 0, issues: [] };
  }
  const sectionBody = (heading: string): string => {
    const re = new RegExp(`##\\s+${heading}[^\\n]*\\n([\\s\\S]*?)(?=\\n##\\s|$)`, 'i');
    return content.match(re)?.[1] ?? '';
  };
  const bullets = (body: string): string[] =>
    body
      .split('\n')
      .map((l) => l.replace(/^\s*-\s+/, '').trim())
      .filter((l) => l.length > 0 && !l.startsWith('|'));
  const strengths = bullets(sectionBody('Strengths|Findings'));
  const issueBullets = bullets(sectionBody('Issues[^\\n]*|Findings'));
  const issues = issueBullets.map((raw) => {
    const m = raw.match(/^\[(high|medium|low|info)\]\s*(.*)$/i);
    return m ? { severity: m[1].toLowerCase(), text: m[2] } : { severity: 'note', text: raw };
  });
  return { strengthsCount: strengths.length, issues };
}

const architectStep = createStep({
  id: 'architect',
  description:
    'Wipe stale agent-generated files (manual/ preserved), then produce docs/02-architecture.md',
  inputSchema: empty,
  outputSchema: empty,
  execute: async () => {
    await cleanupBeforeRegen();
    await architectAgent.generate(
      'Produce the architecture doc now. Follow your instructions exactly.',
    );
    await verifyArchitecture();
    return {};
  },
});

const devUiStep = createStep({
  id: 'dev-ui',
  description: 'Generate Page Objects and Playwright UI specs',
  inputSchema: empty,
  outputSchema: empty,
  execute: async () => {
    await devUiAgent.generate('Implement the UI suite now. Follow your instructions exactly.');
    await verifyUiSuite();
    return {};
  },
});

const devApiStep = createStep({
  id: 'dev-api',
  description: 'Generate Playwright API specs, CSV fixtures and JSON schema',
  inputSchema: empty,
  outputSchema: empty,
  execute: async () => {
    await devApiAgent.generate('Implement the API suite now. Follow your instructions exactly.');
    await verifyApiSuite();
    return {};
  },
});

const blindReviewStep = createStep({
  id: 'blind-review',
  description: 'Fresh-eyes code review (no plan, no architecture) → docs/03-blind-review.md',
  // Accepts the merged output from parallel(dev-ui, dev-api) — contents unused;
  // step reads code from disk.
  inputSchema: z.any(),
  outputSchema: empty,
  execute: async () => {
    await blindReviewAgent.generate(
      'Review the suite now as a fresh pair of eyes. Follow your instructions exactly.',
    );
    await verifyBlindReview();
    return {};
  },
});

const reviewRunStep = createStep({
  id: 'review',
  description: 'Compliance review (plan + architecture + code) → docs/03-review.md',
  // Accepts the merged output from parallel(dev-ui, dev-api) — contents unused.
  inputSchema: z.any(),
  outputSchema: empty,
  execute: async () => {
    await reviewAgent.generate(
      'Review the generated suite now. Follow your instructions exactly.',
    );
    await verifyReview();
    return {};
  },
});

/**
 * Human-in-the-loop gate — runs AFTER both reviewers complete.
 *
 * On first entry: parses both review docs, suspends with combined findings.
 * On resume:
 *   - action="approve" → return approved=true
 *   - action="reject"  → return approved=false
 *   - action="fix"     → run dev-ui + dev-api in parallel with fix prompts,
 *                        then run both reviewers in parallel, then suspend again.
 */
const gateStep = createStep({
  id: 'gate',
  description: 'Combines both reviewers\' verdicts; human picks approve / reject / fix',
  // Accepts the merged output from parallel(blind-review, review) — contents unused;
  // step reads both review docs from disk.
  inputSchema: z.any(),
  outputSchema: z.object({ approved: z.boolean() }),
  suspendSchema: z.object({
    compliance: z.object({
      verdict: z.string(),
      strengthsCount: z.number(),
      issuesBySeverity: z.record(z.string(), z.number()),
      topIssues: z.array(z.object({ severity: z.string(), text: z.string() })),
    }),
    blind: z.object({
      verdict: z.string(),
      strengthsCount: z.number(),
      issuesBySeverity: z.record(z.string(), z.number()),
      topIssues: z.array(z.object({ severity: z.string(), text: z.string() })),
    }),
    prompt: z.string(),
  }),
  resumeSchema: z.object({
    action: z.enum(['approve', 'reject', 'fix']),
  }),
  execute: async ({ resumeData, suspend }) => {
    if (!resumeData) {
      await suspend(await buildGatePayload(1));
      return { approved: false };
    }
    if (resumeData.action === 'approve') return { approved: true };
    if (resumeData.action === 'reject') return { approved: false };

    // Fix cycle — dev agents in parallel, then reviewers in parallel.
    await Promise.all([
      devUiAgent
        .generate(FIX_PROMPT_UI)
        .then(() => verifyUiSuite()),
      devApiAgent
        .generate(FIX_PROMPT_API)
        .then(() => verifyApiSuite()),
    ]);
    await Promise.all([
      blindReviewAgent
        .generate('Re-review the suite after the dev agents applied fixes. Follow your instructions exactly.')
        .then(() => verifyBlindReview()),
      reviewAgent
        .generate('Re-review the suite after the dev agents applied fixes. Follow your instructions exactly.')
        .then(() => verifyReview()),
    ]);
    await suspend(await buildGatePayload(2));
    return { approved: false };
  },
});

const FIX_PROMPT_UI =
  'The code you previously wrote was reviewed. Read docs/03-review.md AND docs/03-blind-review.md ' +
  'and address EVERY issue that affects UI code (pages/*.ts, tests/ui/*.spec.ts). Keep the overall ' +
  'structure; fix only what the reviews flagged. Re-write the affected files via write-file.';

const FIX_PROMPT_API =
  'The code you previously wrote was reviewed. Read docs/03-review.md AND docs/03-blind-review.md ' +
  'and address EVERY issue that affects API code (tests/api/*.spec.ts, data/*). Keep the overall ' +
  'structure; fix only what the reviews flagged. Re-write the affected files via write-file.';

async function buildGatePayload(iteration: number) {
  const compliance = await summarise('docs/03-review.md', 'VERDICT');
  const blind = await summarise('docs/03-blind-review.md', 'BLIND VERDICT');
  const totalIssues = compliance.issues.length + blind.issues.length;
  const prompt =
    `Iteration ${iteration}. ` +
    `Compliance: ${compliance.verdict} (${compliance.strengthsCount} strengths, ${compliance.issues.length} issues). ` +
    `Blind: ${blind.verdict} (${blind.strengthsCount} strengths, ${blind.issues.length} issues). ` +
    `Total ${totalIssues} issues flagged across both reviews. ` +
    `Resume with action="approve" to generate the final README, "reject" to stop, ` +
    `or "fix" to send issues back to dev agents.`;
  return {
    compliance: shrinkForPayload(compliance),
    blind: shrinkForPayload(blind),
    prompt,
  };
}

async function summarise(path: string, verdictMarker: string) {
  const parsed = await parseReviewDoc(path);
  let verdictText = 'UNKNOWN';
  try {
    const content = await readFile(resolve(REPO_ROOT, path), 'utf8');
    const re = new RegExp(`${verdictMarker}:\\s*(APPROVED|NEEDS CHANGES|CLEAN|NITS|ISSUES)`, 'i');
    const m = content.match(re);
    if (m) verdictText = m[1].toUpperCase();
  } catch {
    /* empty */
  }
  return { verdict: verdictText, ...parsed };
}

function shrinkForPayload(parsed: { verdict: string; strengthsCount: number; issues: Array<{ severity: string; text: string }> }) {
  const severityOrder: Record<string, number> = { high: 0, medium: 1, low: 2, info: 3, note: 4 };
  const topIssues = [...parsed.issues]
    .sort((a, b) => (severityOrder[a.severity] ?? 5) - (severityOrder[b.severity] ?? 5))
    .slice(0, 5);
  const issuesBySeverity = parsed.issues.reduce<Record<string, number>>((acc, i) => {
    acc[i.severity] = (acc[i.severity] ?? 0) + 1;
    return acc;
  }, {});
  return {
    verdict: parsed.verdict,
    strengthsCount: parsed.strengthsCount,
    issuesBySeverity,
    topIssues,
  };
}

const reportStep = createStep({
  id: 'report',
  description: 'Produce the final docs/README.md',
  inputSchema: z.object({ approved: z.boolean() }),
  outputSchema: z.object({ delivered: z.boolean(), message: z.string() }),
  execute: async ({ inputData }) => {
    if (!inputData.approved) {
      return { delivered: false, message: 'Review not approved — report skipped.' };
    }
    const res = await reportAgent.generate(
      'Produce the final README now. Follow your instructions exactly.',
    );
    await verifyReport();
    return { delivered: true, message: res.text };
  },
});

export const testGenerationWorkflow = createWorkflow({
  id: 'test-generation',
  description:
    'architect → parallel(dev-ui, dev-api) → parallel(blind-review, review) → gate → report. ' +
    'Suspends at the gate step for human verdict (approve / reject / fix).',
  inputSchema: empty,
  outputSchema: z.object({ delivered: z.boolean(), message: z.string() }),
})
  .then(architectStep)
  .parallel([devUiStep, devApiStep])
  .parallel([blindReviewStep, reviewRunStep])
  .then(gateStep)
  .then(reportStep)
  .commit();
