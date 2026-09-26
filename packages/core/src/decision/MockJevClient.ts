import type { DecisionResult, JevClient } from '../types/index.js';
import { WorkflowError } from '../types/index.js';
import { collectEvidence, collectUserInput, hashString, round2 } from '../utils/context.js';

export interface MockJevClientOptions {
  /**
   * How many pieces of evidence are required before `complete` becomes the
   * answer. Two search results-ish of material is the default.
   */
  evidenceThreshold?: number;
}

/**
 * Deterministic, offline decision engine.
 *
 * This is what makes `pnpm dev` work with an empty `.env`. It reads the workflow
 * context (user input, node outputs, retrieved evidence) and answers the
 * question with one of the configured choices — plus plausible
 * probability / confidence numbers, so the execution trace looks like the real thing.
 *
 * Behaviour on the shipped demo workflow:
 *   Jev #1 (no evidence yet)     -> incomplete  (0.84 / 0.91)
 *   Jev #2 (after mock search)   -> complete    (0.93 / 0.95)
 */
export class MockJevClient implements JevClient {
  readonly name = 'mock-jev';

  private readonly evidenceThreshold: number;

  constructor(options: MockJevClientOptions = {}) {
    this.evidenceThreshold = options.evidenceThreshold ?? 2;
  }

  async decide(question: string, choices: string[], context: unknown): Promise<DecisionResult> {
    const options = choices.map((choice) => choice.trim()).filter((choice) => choice.length > 0);
    if (options.length === 0) {
      throw new WorkflowError('INVALID_DECISION', 'JevClient.decide() needs at least one choice', {
        question,
      });
    }

    const has = (choice: string): boolean => options.includes(choice);
    const evidence = collectEvidence(context);
    const userInput = collectUserInput(context);
    const hasUsableInput = userInput.some((item) => item.trim().length > 0);

    // 1. nothing to reason about at all
    if (!hasUsableInput && has('invalid')) {
      return {
        choice: 'invalid',
        probability: 0.88,
        confidence: 0.93,
        reason: '上下文里没有可用的用户输入，判定为无效请求',
      };
    }

    // 2. enough material collected -> the goal is met
    if (evidence.length >= this.evidenceThreshold && has('complete')) {
      return {
        choice: 'complete',
        probability: 0.93,
        confidence: 0.95,
        reason: `已收集到 ${evidence.length} 条资料（阈值 ${this.evidenceThreshold}），信息足够回答`,
      };
    }

    // 3. material still thin -> keep working the loop
    if (evidence.length < this.evidenceThreshold && has('incomplete')) {
      return {
        choice: 'incomplete',
        probability: 0.84,
        confidence: 0.91,
        reason: `目前只有 ${evidence.length} 条资料（阈值 ${this.evidenceThreshold}），需要继续检索`,
      };
    }

    // 4. user picked custom choices -> stable but clearly-marked fallback
    const index = hashString(`${question}::${options.join('|')}`) % options.length;
    const choice = options[index];
    return {
      choice,
      probability: round2(0.55 + (hashString(choice) % 30) / 100),
      confidence: 0.5,
      reason: '自定义选项：按确定性哈希选取（mock 无真实语义）',
    };
  }
}
