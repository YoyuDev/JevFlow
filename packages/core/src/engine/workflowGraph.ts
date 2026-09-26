import { DEFAULT_NODE_LABELS, NODE_TYPES } from '../constants.js';
import type { Workflow, WorkflowEdge, WorkflowNode, WorkflowNodeType } from '../types/index.js';
import { WorkflowError } from '../types/index.js';

export function findNode(workflow: Workflow, nodeId: string): WorkflowNode | undefined {
  return workflow.nodes.find((node) => node.id === nodeId);
}

export function findStartNode(workflow: Workflow): WorkflowNode | undefined {
  return workflow.nodes.find((node) => node.type === 'start');
}

export function outgoingEdges(workflow: Workflow, nodeId: string): WorkflowEdge[] {
  return workflow.edges.filter((edge) => edge.source === nodeId);
}

export function incomingEdges(workflow: Workflow, nodeId: string): WorkflowEdge[] {
  return workflow.edges.filter((edge) => edge.target === nodeId);
}

export function labelOf(node: WorkflowNode): string {
  const label = node.label?.trim();
  return label && label.length > 0 ? label : DEFAULT_NODE_LABELS[node.type];
}

export function isNodeType(value: unknown): value is WorkflowNodeType {
  return typeof value === 'string' && (NODE_TYPES as readonly string[]).includes(value);
}

/**
 * Structural validation, run before every execution.
 *
 * Deliberately shallow: ids, types, positions and edge endpoints. Everything
 * else is the executors' business. The point is to fail with a precise message
 * *before* anything runs, instead of blowing up in the middle of a run.
 */
export function validateWorkflow(workflow: Workflow | undefined | null): asserts workflow is Workflow {
  if (!workflow || typeof workflow !== 'object') {
    throw new WorkflowError('INVALID_WORKFLOW', 'Workflow is required');
  }
  const workflowId = typeof workflow.id === 'string' ? workflow.id : '';
  if (workflowId.trim().length === 0) {
    throw new WorkflowError('INVALID_WORKFLOW', 'Workflow id is required');
  }
  if (!Array.isArray(workflow.nodes) || workflow.nodes.length === 0) {
    throw new WorkflowError('INVALID_WORKFLOW', 'Workflow has no nodes', { workflowId });
  }
  if (!Array.isArray(workflow.edges)) {
    throw new WorkflowError('INVALID_WORKFLOW', 'Workflow edges must be an array', { workflowId });
  }

  const nodeIds = new Set<string>();
  for (const node of workflow.nodes) {
    if (typeof node.id !== 'string' || node.id.trim().length === 0) {
      throw new WorkflowError('INVALID_WORKFLOW', 'Every node needs a non-empty id', { workflowId });
    }
    if (nodeIds.has(node.id)) {
      throw new WorkflowError('INVALID_WORKFLOW', `Duplicate node id "${node.id}"`, { nodeId: node.id });
    }
    nodeIds.add(node.id);

    if (!isNodeType(node.type)) {
      throw new WorkflowError(
        'INVALID_WORKFLOW',
        `Unknown node type "${String(node.type)}" on node "${node.id}"`,
        {
          nodeId: node.id,
          type: node.type,
        },
      );
    }
    if (
      !node.position ||
      typeof node.position.x !== 'number' ||
      typeof node.position.y !== 'number' ||
      !Number.isFinite(node.position.x) ||
      !Number.isFinite(node.position.y)
    ) {
      throw new WorkflowError('INVALID_WORKFLOW', `Node "${node.id}" has an invalid position`, {
        nodeId: node.id,
      });
    }
  }

  const edgeIds = new Set<string>();
  for (const edge of workflow.edges) {
    if (typeof edge.id !== 'string' || edge.id.trim().length === 0) {
      throw new WorkflowError('INVALID_WORKFLOW', 'Every edge needs a non-empty id', { workflowId });
    }
    if (edgeIds.has(edge.id)) {
      throw new WorkflowError('INVALID_WORKFLOW', `Duplicate edge id "${edge.id}"`, { edgeId: edge.id });
    }
    edgeIds.add(edge.id);

    if (!nodeIds.has(edge.source)) {
      throw new WorkflowError(
        'INVALID_WORKFLOW',
        `Edge "${edge.id}" starts at unknown node "${edge.source}"`,
        {
          edgeId: edge.id,
          source: edge.source,
        },
      );
    }
    if (!nodeIds.has(edge.target)) {
      throw new WorkflowError(
        'INVALID_WORKFLOW',
        `Edge "${edge.id}" points to unknown node "${edge.target}"`,
        {
          edgeId: edge.id,
          target: edge.target,
        },
      );
    }
  }

  const startNodes = workflow.nodes.filter((node) => node.type === 'start');
  if (startNodes.length === 0) {
    throw new WorkflowError('START_NODE_NOT_FOUND', 'Workflow needs exactly one Start node', { workflowId });
  }
  if (startNodes.length > 1) {
    throw new WorkflowError(
      'INVALID_WORKFLOW',
      `Workflow has ${startNodes.length} Start nodes; only one is allowed`,
      {
        workflowId,
      },
    );
  }
}
