import type { Workflow } from '@jevflow/core';

const CHOICES = ['complete', 'incomplete', 'invalid'];

/**
 * "Research Agent" — the same workflow the Studio seeds into SQLite, written out
 * as plain TypeScript so it can run without a server, a database or a canvas.
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
 */
export const researchWorkflow: Workflow = {
  id: 'research-agent',
  name: 'Research Agent',
  description:
    'A decision-driven research loop: draft an answer, let Jev judge whether it is good enough, search for more material, refine, judge again.',
  version: 1,
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
  nodes: [
    { id: 'start-1', type: 'start', label: 'Start', position: { x: 340, y: 0 } },
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
      config: { question: '当前信息是否足以完整回答用户的问题？', choices: CHOICES },
    },
    {
      id: 'tool-1',
      type: 'tool',
      label: 'Mock search',
      position: { x: 60, y: 490 },
      config: { tool: 'search', query: '{{input}}' },
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
      config: { question: '补充资料之后，信息是否已经足够回答用户的问题？', choices: CHOICES },
    },
    { id: 'end-1', type: 'end', label: 'Done', position: { x: 420, y: 1000 }, config: {} },
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
