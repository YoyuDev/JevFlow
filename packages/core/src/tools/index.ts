import type { Tool } from '../types/index.js';
import { MockSearchTool } from './MockSearchTool.js';
import { ToolRegistry } from './ToolRegistry.js';

export { ToolRegistry } from './ToolRegistry.js';
export { MockSearchTool } from './MockSearchTool.js';
export type { MockSearchResult } from './MockSearchTool.js';

/** Tools a fresh engine ships with: mock search only, in phase 1. */
export function createDefaultTools(): Tool[] {
  return [new MockSearchTool()];
}

export function createDefaultToolRegistry(extra: readonly Tool[] = []): ToolRegistry {
  return new ToolRegistry([...createDefaultTools(), ...extra]);
}
