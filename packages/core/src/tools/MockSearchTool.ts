import type { Tool, ToolRunContext } from '../types/index.js';
import { stringifyValue } from '../utils/interpolate.js';
import { truncate } from '../utils/value.js';

export interface MockSearchResult {
  provider: string;
  query: string;
  total: number;
  tookMs: number;
  results: string[];
}

/**
 * Offline mock of a web/knowledge search tool.
 *
 * Results are templated from the query instead of hard-coded, so they stay
 * on-topic for whatever the workflow is researching.
 */
export class MockSearchTool implements Tool {
  readonly name = 'search';
  readonly description = '离线模拟检索：根据 query 返回若干条资料片段（无网络请求）。';

  async run(args: Record<string, unknown>, ctx: ToolRunContext): Promise<MockSearchResult> {
    const query = resolveQuery(args, ctx);
    const topic = truncate(query, 24);
    const results = [
      `${topic} · 概览：${topic} 的核心组成通常包括规划（Planning）、工具调用（Tool Use）与记忆（Memory）三部分；三者由状态容器串联。`,
      `${topic} · 工程实践：最小可用系统一般包含模型客户端、工具注册表、状态对象与循环控制器；把「生成」与「判断」拆成独立环节，能显著降低调试成本。`,
      `${topic} · 常见坑：缺少停止条件会导致无限循环，工具返回结构不稳定会让模型反复试错，因此需要一个显式决策节点来判定 complete / incomplete / invalid。`,
    ];

    return {
      provider: 'mock-search',
      query,
      total: results.length,
      tookMs: 0,
      results,
    };
  }
}

function resolveQuery(args: Record<string, unknown>, ctx: ToolRunContext): string {
  const fromArgs = args['query'];
  if (typeof fromArgs === 'string' && fromArgs.trim().length > 0) return fromArgs.trim();
  const fromInput = stringifyValue(ctx.input).trim();
  return fromInput.length > 0 ? fromInput : 'AI Agent';
}
