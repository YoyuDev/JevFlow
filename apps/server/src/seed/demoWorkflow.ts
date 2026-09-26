import type { Logger, Workflow } from '@jevflow/core';
import { DEFAULT_DEMO_WORKFLOW_ID } from '../constants.js';
import type { WorkflowRepository } from '../database/WorkflowRepository.js';

const CHOICES = ['complete', 'incomplete', 'invalid'];

/**
 * The workflow the project ships with — "Research Agent".
 *
 * ```
 *                        Start
 *                          ↓
 *                         LLM  (draft answer)
 *                          ↓
 *                         Jev  ── complete ──────────────→ End
 *                          │
 *                       incomplete
 *                          ↓
 *                    Tool: search
 *                          ↓
 *                         LLM  (refine with the hits)
 *                          ↓
 *                         Jev  ── complete ──────────────→ End
 *                          │
 *                       incomplete ──→ back to search (retry)
 * ```
 *
 * Runs end-to-end offline: mock LLM drafts, mock Jev says `incomplete`,
 * mock search returns hits, the second Jev says `complete`, End.
 */
export function createDemoWorkflow(): Workflow {
  const now = new Date().toISOString();
  return {
    id: DEFAULT_DEMO_WORKFLOW_ID,
    name: 'Research Agent',
    description:
      'A decision-driven research loop: draft an answer, let Jev judge whether it is good enough, search for more material, refine, judge again.',
    version: 1,
    createdAt: now,
    updatedAt: now,
    nodes: [
      {
        id: 'start-1',
        type: 'start',
        label: 'Start',
        position: { x: 340, y: 0 },
      },
      {
        id: 'llm-1',
        type: 'llm',
        label: 'Draft answer',
        position: { x: 340, y: 150 },
        config: {
          model: 'mock-model',
          systemPrompt: '你是一个严谨、务实的研究助手。回答要具体，不要空话。',
          prompt: '请介绍一下：{{input}}',
          temperature: 0.7,
        },
      },
      {
        id: 'jev-1',
        type: 'jev',
        label: 'Is it enough?',
        position: { x: 340, y: 320 },
        config: {
          question: '当前信息是否足以完整回答用户的问题？',
          choices: CHOICES,
        },
      },
      {
        id: 'tool-1',
        type: 'tool',
        label: 'Mock search',
        position: { x: 60, y: 490 },
        config: {
          tool: 'search',
          query: '{{input}}',
        },
      },
      {
        id: 'llm-2',
        type: 'llm',
        label: 'Refine answer',
        position: { x: 60, y: 660 },
        config: {
          model: 'mock-model',
          prompt:
            '根据下面的参考资料，补充并完善回答。\n\n原始问题：{{input}}\n\n参考资料：\n{{tool-1}}\n\n初步回答：\n{{llm-1}}\n\n请整合资料，输出一版更完整的回答。',
          temperature: 0.3,
        },
      },
      {
        id: 'jev-2',
        type: 'jev',
        label: 'Is it enough now?',
        position: { x: 60, y: 830 },
        config: {
          question: '补充资料之后，信息是否已经足够回答用户的问题？',
          choices: CHOICES,
        },
      },
      {
        id: 'end-1',
        type: 'end',
        label: 'Done',
        position: { x: 420, y: 1000 },
        config: {},
      },
    ],
    edges: [
      { id: 'edge-1', source: 'start-1', target: 'llm-1' },
      { id: 'edge-2', source: 'llm-1', target: 'jev-1' },
      { id: 'edge-3', source: 'jev-1', target: 'end-1', condition: 'complete' },
      { id: 'edge-4', source: 'jev-1', target: 'tool-1', condition: 'incomplete' },
      { id: 'edge-5', source: 'tool-1', target: 'llm-2' },
      { id: 'edge-6', source: 'llm-2', target: 'jev-2' },
      { id: 'edge-7', source: 'jev-2', target: 'end-1', condition: 'complete' },
      { id: 'edge-8', source: 'jev-2', target: 'tool-1', condition: 'incomplete' },
    ],
  };
}

/** Inserts the demo workflow when the database is still empty. */
export function ensureDemoWorkflow(repository: WorkflowRepository, logger: Logger): Workflow | null {
  if (repository.count() > 0) {
    logger.info('demo workflow skipped', { reason: 'database already contains workflows' });
    return null;
  }
  const demo = createDemoWorkflow();
  const created = repository.create({
    id: demo.id,
    name: demo.name,
    ...(demo.description !== undefined ? { description: demo.description } : {}),
    nodes: demo.nodes,
    edges: demo.edges,
  });
  logger.info('demo workflow created', { workflowId: created.id, nodes: created.nodes.length });
  return created;
}
