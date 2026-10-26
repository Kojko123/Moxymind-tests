/**
 * Mastra instance — the entry point loaded by `mastra dev`.
 *
 * Exports every agent so you can chat with them in the playground, and
 * registers the autonomous workflow that chains architect → dev → review → report.
 */
import 'dotenv/config';
import { Mastra } from '@mastra/core/mastra';
import { ConsoleLogger } from '@mastra/core/logger';

import { brainstormAgent } from './agents/brainstorm.js';
import { architectAgent } from './agents/architect.js';
import { devUiAgent } from './agents/dev-ui.js';
import { devApiAgent } from './agents/dev-api.js';
import { blindReviewAgent } from './agents/blind-review.js';
import { reviewAgent } from './agents/review.js';
import { reportAgent } from './agents/report.js';

import { testGenerationWorkflow } from './workflows/test-generation.js';

export const mastra = new Mastra({
  agents: {
    brainstorm: brainstormAgent,
    architect: architectAgent,
    devUi: devUiAgent,
    devApi: devApiAgent,
    blindReview: blindReviewAgent,
    review: reviewAgent,
    report: reportAgent,
  },
  workflows: {
    testGeneration: testGenerationWorkflow,
  },
  logger: new ConsoleLogger({ name: 'moxymind-tests', level: 'info' }),
});
