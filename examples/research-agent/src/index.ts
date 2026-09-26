/**
 * Headless JevFlow — no server, no database, no browser.
 *
 * ```bash
 * pnpm example:research
 * pnpm example:research "帮我想想怎么写工作流编排工具的文档"
 * ```
 *
 * This is the "npm usage" story: install `@jevflow/core`, hand it a workflow,
 * read the execution trace.
 */
import { ConsoleLogger, WorkflowEngine, type NodeExecutionRecord } from '@jevflow/core';
import { researchWorkflow } from './workflow.js';

function renderTrace(trace: NodeExecutionRecord[]): string {
  const lines = trace.map((record) => {
    const icon = record.status === 'failed' ? '✕' : '✓';
    const head = `${icon} ${record.label.padEnd(18, ' ')} ${record.nodeType.padEnd(5, ' ')} ${String(
      record.durationMs,
    ).padStart(4, ' ')}ms`;
    if (record.decision) {
      const probability = record.probability?.toFixed(2) ?? '—';
      const confidence = record.confidence?.toFixed(2) ?? '—';
      return `${head}  choice=${record.decision.choice}  p=${probability}  c=${confidence}`;
    }
    if (record.error) return `${head}  error=${record.error}`;
    return head;
  });
  return lines.join('\n');
}

function renderOutput(output: unknown): string {
  if (typeof output === 'string') return output;
  if (output === null || output === undefined) return '(empty)';
  if (typeof output === 'object' && 'content' in (output as Record<string, unknown>)) {
    const content = (output as Record<string, unknown>)['content'];
    if (typeof content === 'string') return content;
  }
  return JSON.stringify(output, null, 2);
}

async function main(): Promise<void> {
  const input = process.argv.slice(2).join(' ').trim() || '请介绍一下 AI Agent';

  const engine = new WorkflowEngine({ logger: new ConsoleLogger('research-agent', 'info') });
  const capabilities = engine.capabilities;

  console.log('─'.repeat(78));
  console.log('JevFlow · Research Agent');
  console.log(`llm=${capabilities.llm}  jev=${capabilities.jev}  tools=${capabilities.tools.join(', ')}`);
  console.log('─'.repeat(78));
  console.log(`input: ${input}`);
  console.log('');

  const result = await engine.run(researchWorkflow, { input });

  console.log('Execution trace');
  console.log(renderTrace(result.trace));
  console.log('');
  console.log(`status   : ${result.status}`);
  console.log(`steps    : ${result.steps}`);
  console.log(`duration : ${result.durationMs}ms`);
  if (result.error) console.log(`error    : ${result.error}`);
  console.log('');
  console.log('Output');
  console.log('─'.repeat(78));
  console.log(renderOutput(result.output));
  console.log('─'.repeat(78));
}

main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
