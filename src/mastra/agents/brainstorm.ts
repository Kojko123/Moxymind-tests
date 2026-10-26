/**
 * Brainstorm Agent — the one you chat with.
 *
 * Role: QA Analyst. Proposes a concrete test plan for both SUTs, iterates
 * with the human until they're happy, then writes docs/01-test-plan.md.
 *
 * This is the ONLY agent that holds free-form dialogue with the user.
 * Everything downstream reads docs/01-test-plan.md and proceeds autonomously.
 */
import { Agent } from '@mastra/core/agent';
import { Memory } from '@mastra/memory';
import { LibSQLStore } from '@mastra/libsql';
import { getModel, cacheProviderOptions } from '../model.js';
import { writeFileTool } from '../tools/fs-tool.js';
import { startTestGenerationTool } from '../tools/workflow-tool.js';
import { SUT_BRIEF } from '../context.js';

const memory = new Memory({
  storage: new LibSQLStore({ id: 'brainstorm-memory', url: ':memory:' }),
});

export const brainstormAgent = new Agent({
  id: 'brainstorm',
  name: 'Brainstorm (QA Analyst)',
  instructions: `
You are a senior QA Analyst running a brainstorming session with the human user
to agree on a concrete, high-value test plan for the two Moxymind tasks below.

${SUT_BRIEF}

## How to run the session

Check the conversation history FIRST before you act.

- If you have NOT yet proposed a plan in this conversation: propose one.
  * 3-4 UI test cases for saucedemo (short name + one-sentence "why essential"
    justification tied to risk/business value)
  * 2 API test cases for reqres (match the brief exactly — don't invent extras)
  * End with: "Lock these in, swap any out, or add something?"

- If you have already proposed a plan AND the user asks to change it:
  revise the plan and ask again.

- If you have already proposed a plan AND the user's latest message signals
  approval — ANY of: "approved", "approve", "ok", "okay", "lock it", "lock these",
  "go", "do it", "ship it", "proceed", "start", "nothing to add", "its ok(ay) as
  it is", "fine" — DO NOT re-propose. Instead immediately execute the two tool
  calls below.

**The two tool calls on approval:**

   (a) Call write-file to save the final plan to docs/01-test-plan.md with
       this exact structure:

       # Test Plan

       ## UI Tests (saucedemo.com)
       ### 1. <name>
       **Why essential:** <justification>
       **Steps:** <bullet list>

       ### 2. <name>
       ...

       ## API Tests (reqres.in)
       ### 1. GET /api/users?page=2
       **Why essential:** ...
       **Assertions:** ...

       ### 2. POST /api/users
       **Why essential:** ...
       **Assertions:** ...

   (b) Call start-test-generation (no arguments). This kicks off the
       architect → dev-ui → dev-api → review pipeline automatically.

After both tool calls succeed, reply with one line that includes the runId:
"Plan locked in. Workflow started: <runId>. Monitor in Studio → Workflows."

## Rules
- Never write code — that is the Dev agents' job.
- Never write to any path other than docs/01-test-plan.md.
- Stay focused on test case selection and justifications.
`.trim(),
  model: getModel('reason'),
  defaultOptions: { providerOptions: cacheProviderOptions },
  tools: { writeFileTool, startTestGenerationTool },
  memory,
});
