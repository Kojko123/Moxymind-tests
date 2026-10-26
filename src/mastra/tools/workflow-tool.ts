/**
 * Tool that lets the Brainstorm agent kick off the test-generation workflow
 * automatically once the user approves the test plan.
 *
 * Fire-and-forget: starts the workflow in the background and returns the runId
 * immediately so the agent can confirm the handoff.
 */
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';
import { verifyTestPlan } from '../workflows/verify.js';

export const startTestGenerationTool = createTool({
  id: 'start-test-generation',
  description:
    'Start the autonomous test-generation workflow (architect → dev-ui → dev-api → review). ' +
    'Call ONLY after you have written docs/01-test-plan.md AND the user has approved the plan.',
  inputSchema: z.object({}),
  outputSchema: z.object({
    runId: z.string(),
    status: z.string(),
  }),
  execute: async (_input, context) => {
    const mastra = context?.mastra;
    if (!mastra) {
      throw new Error('Mastra instance not available on tool context');
    }
    await verifyTestPlan();
    const workflow = mastra.getWorkflow('testGeneration');
    const run = await workflow.createRun();
    run.start({ inputData: {} }).catch((err: unknown) => {
      console.error('[test-generation workflow error]', err);
    });
    return { runId: run.runId, status: 'started' };
  },
});
