import type {
  Logger,
  NodeExecutionInput,
  NodeExecutionOutput,
  NodeExecutor,
  WorkflowNodeType,
} from '../types/index.js';
import { WorkflowError } from '../types/index.js';
import { EndNodeExecutor } from './EndNodeExecutor.js';
import { HttpNodeExecutor } from './HttpNodeExecutor.js';
import { JevNodeExecutor } from './JevNodeExecutor.js';
import { LLMNodeExecutor } from './LLMNodeExecutor.js';
import { StartNodeExecutor } from './StartNodeExecutor.js';
import { ToolNodeExecutor } from './ToolNodeExecutor.js';

/** Node type → executor. Adding a node type = registering one executor. */
export class NodeExecutorRegistry {
  private readonly executors = new Map<WorkflowNodeType, NodeExecutor>();

  constructor(executors: readonly NodeExecutor[] = []) {
    for (const executor of executors) this.register(executor);
  }

  register(executor: NodeExecutor): this {
    this.executors.set(executor.type, executor);
    return this;
  }

  has(type: WorkflowNodeType): boolean {
    return this.executors.has(type);
  }

  get(type: WorkflowNodeType): NodeExecutor | undefined {
    return this.executors.get(type);
  }

  /** Same as `get`, but throws the error the engine wants to record. */
  mustGet(type: WorkflowNodeType): NodeExecutor {
    const executor = this.executors.get(type);
    if (!executor) {
      throw new WorkflowError('NODE_EXECUTION_FAILED', `No executor registered for node type "${type}"`, {
        type,
        available: this.types(),
      });
    }
    return executor;
  }

  list(): NodeExecutor[] {
    return [...this.executors.values()];
  }

  types(): WorkflowNodeType[] {
    return [...this.executors.keys()];
  }
}

/** Every executor that ships with the package. */
export function createDefaultNodeExecutors(): NodeExecutor[] {
  return [
    new StartNodeExecutor(),
    new LLMNodeExecutor(),
    new JevNodeExecutor(),
    new ToolNodeExecutor(),
    new HttpNodeExecutor(),
    new EndNodeExecutor(),
  ];
}

/** Helper for custom executors that only need a logger. */
export type ExecutorLogger = Logger;

export type { NodeExecutionInput, NodeExecutionOutput, NodeExecutor };
