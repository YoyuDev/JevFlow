import type { ComposerTranslation } from 'vue-i18n';
import { translate } from '@/i18n';
import type { NodeType } from '@/types';

export type NodeGroup = 'trigger' | 'ai' | 'tools' | 'control';

export interface NodeCatalogItem {
  type: NodeType;
  group: NodeGroup;
}

export const NODE_CATALOG_GROUPS: readonly NodeGroup[] = ['trigger', 'ai', 'tools', 'control'];

/**
 * The node palette. Phase 1 ships exactly these five.
 *
 * Only structural facts live here — every human-readable string is a message
 * key (`nodes.<type>.label`, `nodes.groups.<group>`), so the palette follows the
 * active language instead of being frozen at build time.
 */
export const NODE_CATALOG: readonly NodeCatalogItem[] = [
  { type: 'start', group: 'trigger' },
  { type: 'llm', group: 'ai' },
  { type: 'jev', group: 'ai' },
  { type: 'tool', group: 'tools' },
  { type: 'end', group: 'control' },
];

export const NODE_ACCENTS: Record<NodeType, string> = {
  start: '#0ea5e9',
  llm: '#7c3aed',
  jev: '#f59e0b',
  tool: '#10b981',
  end: '#64748b',
};

export function nodeLabelKey(type: NodeType): string {
  return `nodes.${type}.label`;
}

export function nodeDescriptionKey(type: NodeType): string {
  return `nodes.${type}.description`;
}

export function nodeGroupKey(group: NodeGroup): string {
  return `nodes.groups.${group}`;
}

/** Default label for a freshly created node — persisted as the node's own data. */
export function defaultLabel(type: NodeType): string {
  return translate(nodeLabelKey(type));
}

/** Config a freshly dropped node starts with — mirrors the runtime defaults. */
export function defaultConfig(type: NodeType): Record<string, unknown> {
  switch (type) {
    case 'llm':
      return {
        // Left empty on purpose: the model comes from the connection the node
        // points at, or from the client default. An override can be typed here.
        model: '',
        systemPrompt: translate('nodes.llm.defaultSystemPrompt'),
        prompt: '{{input}}',
        temperature: 0.7,
      };
    case 'jev':
      return {
        question: translate('nodes.jev.defaultQuestion'),
        choices: ['complete', 'incomplete', 'invalid'],
      };
    case 'tool':
      return {
        tool: 'search',
        query: '{{input}}',
      };
    case 'start':
    case 'end':
    default:
      return {};
  }
}

/** One-line summary rendered inside a node on the canvas. */
export function summarizeNode(
  type: NodeType,
  config: Record<string, unknown>,
  t: ComposerTranslation,
  providerName?: (id: string) => string | undefined,
): string {
  const text = (key: string): string => {
    const value = config[key];
    return typeof value === 'string' ? value.trim() : '';
  };
  /** “DeepSeek / deepseek-chat” — the connection is the interesting part. */
  const head = (...parts: Array<string | undefined>): string =>
    parts.filter((part): part is string => Boolean(part)).join(' / ');

  switch (type) {
    case 'start':
      return t('nodes.summary.start');
    case 'end':
      return text('output') ? t('nodes.summary.endCustom') : t('nodes.summary.endDefault');
    case 'llm': {
      const provider = providerName?.(text('providerId'));
      const name = head(provider, text('model')) || 'mock';
      const prompt = text('prompt') || '{{input}}';
      return `${name} · ${truncate(prompt, 40)}`;
    }
    case 'jev': {
      const provider = providerName?.(text('providerId')) ?? 'mock';
      const question = text('question') || t('nodes.summary.untitledQuestion');
      const choices = Array.isArray(config['choices']) ? config['choices'].length : 0;
      return `${provider} · ${truncate(question, 32)} · ${t('nodes.summary.choiceCount', { count: choices })}`;
    }
    case 'tool': {
      const tool = text('tool') || 'search';
      const query = text('query') || '{{input}}';
      return `${tool} · ${truncate(query, 40)}`;
    }
    default:
      return '';
  }
}

function truncate(value: string, max: number): string {
  return value.length <= max ? value : `${value.slice(0, max - 1)}…`;
}
