import type { NodeExecutionRecord } from '../types/index.js';

/**
 * Ordered log of everything that ran.
 *
 * The engine appends one record per node (success *or* failure) and may patch
 * the last one when a routing error is attributed back to that node.
 */
export class ExecutionTrace {
  private readonly records: NodeExecutionRecord[] = [];

  add(record: NodeExecutionRecord): NodeExecutionRecord {
    this.records.push(record);
    return record;
  }

  /** Applies a partial update to the most recent record. */
  patchLast(patch: Partial<NodeExecutionRecord>): NodeExecutionRecord | undefined {
    const last = this.records[this.records.length - 1];
    if (!last) return undefined;
    Object.assign(last, patch);
    return last;
  }

  get all(): NodeExecutionRecord[] {
    return [...this.records];
  }

  get length(): number {
    return this.records.length;
  }

  get last(): NodeExecutionRecord | undefined {
    return this.records[this.records.length - 1];
  }

  get failed(): NodeExecutionRecord[] {
    return this.records.filter((record) => record.status === 'failed');
  }

  hasFailures(): boolean {
    return this.records.some((record) => record.status === 'failed');
  }

  /** Output of the last node that succeeded. */
  lastSuccessOutput(): unknown {
    for (let index = this.records.length - 1; index >= 0; index -= 1) {
      const record = this.records[index];
      if (record && record.status === 'success') return record.output;
    }
    return undefined;
  }

  toJSON(): NodeExecutionRecord[] {
    return this.all;
  }
}
