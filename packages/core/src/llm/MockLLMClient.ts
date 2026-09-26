import { DEFAULT_LLM_MODEL, DEFAULT_LLM_TEMPERATURE } from '../constants.js';
import type { LLMClient, LLMRequest, LLMResponse } from '../types/index.js';
import { collectEvidence } from '../utils/context.js';
import { truncate } from '../utils/value.js';

/**
 * Offline, deterministic LLM.
 *
 * It is not a "hello world" stub — it reads the prompt and any evidence that
 * flowed in through the workflow context, and produces a structured answer.
 * That way the demo workflow actually *reads* like a workflow, with zero API keys.
 */
export class MockLLMClient implements LLMClient {
  readonly name = 'mock-llm';

  /** Number of calls in this process, surfaced in the output for traceability. */
  private callCount = 0;

  async complete(request: LLMRequest): Promise<LLMResponse> {
    this.callCount += 1;
    const content = this.compose(request);
    const promptTokens = estimateTokens(`${request.systemPrompt ?? ''}\n${request.prompt}`);
    const completionTokens = estimateTokens(content);
    return {
      content,
      model: request.model ?? DEFAULT_LLM_MODEL,
      usage: {
        promptTokens,
        completionTokens,
        totalTokens: promptTokens + completionTokens,
      },
    };
  }

  private compose(request: LLMRequest): string {
    const evidence = collectEvidence(request.context);
    const topic = extractTopic(request.prompt);
    const model = request.model ?? DEFAULT_LLM_MODEL;
    const temperature = request.temperature ?? DEFAULT_LLM_TEMPERATURE;
    const lines: string[] = [];

    if (evidence.length > 0) {
      lines.push(`【模拟回答】围绕「${topic}」，结合已收集到的 ${evidence.length} 条资料：`);
      lines.push('');
      evidence.slice(0, 4).forEach((item, index) => {
        lines.push(`${index + 1}. ${truncate(item, 180)}`);
      });
      lines.push('');
      lines.push(
        `小结：${topic} 的落地关键是把「生成」和「判断」拆开——模型负责产出内容，独立的决策节点负责判断内容是否达标，运行时就负责按判断结果继续走分支。`,
      );
    } else {
      lines.push(`【模拟回答】关于「${topic}」，先给出一个初步回答：`);
      lines.push('');
      lines.push(`1. 是什么：${topic} 通常指让模型在给定上下文里规划步骤、调用工具并迭代完成目标的系统。`);
      lines.push('2. 怎么跑：一般包含模型客户端、工具、状态容器与循环控制四部分。');
      lines.push('3. 注意什么：缺少停止条件会导致无限循环，所以需要显式的判断环节。');
      lines.push('');
      lines.push('以上信息尚未经过检索验证，建议补充资料后再做结论。');
    }

    lines.push('');
    lines.push(
      `— mock 输出 · 第 ${this.callCount} 次调用 · model=${model} · temperature=${temperature}` +
        (request.systemPrompt ? ' · 已应用 system prompt' : ''),
    );
    return lines.join('\n');
  }
}

/** Pulls a short topic label out of an arbitrary prompt template. */
function extractTopic(prompt: string): string {
  const explicit = /(?:原始问题|问题|主题|topic)\s*[：:]\s*([^\n]+)/i.exec(prompt);
  const source = explicit?.[1] ?? prompt;

  const cleaned = source
    .replace(/\{\{[^}]*\}\}/g, ' ')
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.length > 0)
    .join(' ')
    .replace(/^(你好|请|帮我|麻烦|帮忙|请帮我|请帮我)[，,、\s]*/g, '')
    .replace(
      /^(介绍一下|介绍下|介绍|说明一下|说明|解释一下|解释|讲一下|讲解|研究一下|研究|分析一下|分析|总结一下|总结|补充回答)/g,
      '',
    )
    .trim();

  const firstSegment = cleaned
    .split(/[：:，,。.！!？?；;\s]/)
    .map((segment) => segment.trim())
    .filter((segment) => segment.length > 0)[0];

  return truncate(firstSegment ?? cleaned ?? '当前问题', 32);
}

/** Rough token estimate — good enough for mock usage numbers. */
function estimateTokens(text: string): number {
  if (!text) return 0;
  return Math.max(1, Math.round(text.length / 2.5));
}
