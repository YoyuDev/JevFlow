import type { Tool, ToolRegistryLike } from '../types/index.js';
import { WorkflowError } from '../types/index.js';

/** Name → tool. The only thing the Tool node executor knows about tools. */
export class ToolRegistry implements ToolRegistryLike {
  private readonly tools = new Map<string, Tool>();

  constructor(tools: readonly Tool[] = []) {
    for (const tool of tools) this.register(tool);
  }

  register(tool: Tool): this {
    if (this.tools.has(tool.name)) {
      throw new WorkflowError('INVALID_CONFIG', `Tool "${tool.name}" is already registered`);
    }
    this.tools.set(tool.name, tool);
    return this;
  }

  get(name: string): Tool | undefined {
    return this.tools.get(name);
  }

  has(name: string): boolean {
    return this.tools.has(name);
  }

  list(): Tool[] {
    return [...this.tools.values()];
  }

  names(): string[] {
    return [...this.tools.keys()];
  }
}
