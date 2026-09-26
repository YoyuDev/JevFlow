import { computed, ref, type Ref } from 'vue';
import { defineStore } from 'pinia';
import { MarkerType, Position, type Connection, type EdgeChange, type NodeChange } from '@vue-flow/core';
import { runtimeApi, workflowApi } from '@/api';
import { errorMessage } from '@/api/client';
import { defaultConfig, defaultLabel } from '@/constants/nodeCatalog';
import { translate } from '@/i18n';
import { toast } from '@/utils/toast';
import type {
  ExecutionRecord,
  FlowEdge,
  FlowNode,
  NodeType,
  RuntimeInfo,
  TraceEntry,
  Workflow,
  WorkflowEdge,
  WorkflowNode,
  WorkflowPayload,
  WorkflowSummary,
} from '@/types';

/** Name a brand-new workflow starts with; localised at creation time. */
function untitledName(): string {
  return translate('workflow.untitled');
}

/** What the Run dialog starts with — matches the shipped demo workflow. */
function defaultRunInput(): string {
  return translate('run.defaultInput');
}

/**
 * Single source of truth for the Studio.
 *
 * The canvas is driven by `nodes` / `edges` (Vue Flow shapes). Serialisation to
 * the persisted schema (`WorkflowNode` / `WorkflowEdge`) happens in exactly two
 * places: `toPayload()` on the way out, `toFlowNode()`/`toFlowEdge()` on the way in.
 */
export const useWorkflowStore = defineStore('workflow', () => {
  /* --------------------------------- state -------------------------------- */
  const summaries = ref<WorkflowSummary[]>([]);
  const current = ref<Workflow | null>(null);
  // `ref()` would deep-unwrap Vue Flow's already-generic node type and blow up
  // instantiation depth (TS2589), so the arrays are pinned to their own shape.
  const nodes = ref([]) as Ref<FlowNode[]>;
  const edges = ref([]) as Ref<FlowEdge[]>;

  const selectedNodeId = ref<string | null>(null);
  const selectedEdgeId = ref<string | null>(null);
  const activeTraceIndex = ref<number | null>(null);

  const loading = ref(false);
  const saving = ref(false);
  const running = ref(false);
  const dirty = ref(false);

  const trace = ref<TraceEntry[]>([]);
  const execution = ref<ExecutionRecord | null>(null);
  const runtime = ref<RuntimeInfo | null>(null);
  const lastInput = ref(defaultRunInput());

  /* ------------------------------- getters -------------------------------- */
  const hasWorkflow = computed(() => current.value !== null);
  const isPersisted = computed(() => (current.value?.id ?? '').length > 0);
  const selectedNode = computed(() => nodes.value.find((node) => node.id === selectedNodeId.value) ?? null);
  const selectedEdge = computed(() => edges.value.find((edge) => edge.id === selectedEdgeId.value) ?? null);
  const outgoingEdgesOfSelected = computed(() =>
    edges.value.filter((edge) => edge.source === selectedNodeId.value),
  );
  const activeTrace = computed(() => {
    const index = activeTraceIndex.value;
    if (index === null) return null;
    return trace.value[index] ?? null;
  });
  const runStatus = computed<TraceEntry['status'] | 'idle'>(() => {
    if (running.value) return 'idle';
    return execution.value?.status === 'failed' ? 'failed' : execution.value ? 'success' : 'idle';
  });

  const name = computed<string>({
    get: () => current.value?.name ?? '',
    set: (value: string) => {
      if (!current.value) return;
      current.value.name = value;
      dirty.value = true;
    },
  });

  const description = computed<string>({
    get: () => current.value?.description ?? '',
    set: (value: string) => {
      if (!current.value) return;
      current.value.description = value;
      dirty.value = true;
    },
  });

  /* ------------------------------ lifecycle ------------------------------- */
  async function initialise(): Promise<void> {
    loading.value = true;
    try {
      runtime.value = await runtimeApi.info();
      summaries.value = await workflowApi.list();
      const first = summaries.value[0];
      if (first) await open(first.id);
      else createNew();
    } catch (error) {
      toast.error('toast.connectFailed', { error: errorMessage(error) });
    } finally {
      loading.value = false;
    }
  }

  async function refreshList(): Promise<void> {
    try {
      summaries.value = await workflowApi.list();
    } catch (error) {
      toast.error('toast.requestFailed', { error: errorMessage(error) });
    }
  }

  async function open(id: string): Promise<void> {
    loading.value = true;
    try {
      const workflow = await workflowApi.get(id);
      applyWorkflow(workflow);
    } catch (error) {
      toast.error('toast.requestFailed', { error: errorMessage(error) });
    } finally {
      loading.value = false;
    }
  }

  function createNew(): void {
    const now = new Date().toISOString();
    current.value = {
      id: '',
      name: untitledName(),
      description: '',
      version: 0,
      nodes: [],
      edges: [],
      createdAt: now,
      updatedAt: now,
    };
    nodes.value = [createFlowNode('start', { x: 340, y: 40 }, 'start-1')];
    edges.value = [];
    afterLoad();
  }

  function applyWorkflow(workflow: Workflow): void {
    current.value = workflow;
    nodes.value = workflow.nodes.map(toFlowNode);
    edges.value = workflow.edges.map(toFlowEdge);
    afterLoad();
  }

  function afterLoad(): void {
    selectedNodeId.value = null;
    selectedEdgeId.value = null;
    activeTraceIndex.value = null;
    trace.value = [];
    execution.value = null;
    dirty.value = false;
  }

  /* ------------------------------- mutations ------------------------------ */
  /** `llm-1`, `llm-2`, … — derived from live canvas state, so reloading a
   *  saved workflow can never produce a duplicate id. */
  function nextNodeId(type: NodeType): string {
    const taken = new Set(nodes.value.map((node) => node.id));
    let index = 1;
    while (taken.has(`${type}-${index}`)) index += 1;
    return `${type}-${index}`;
  }

  function nextEdgeId(): string {
    const taken = new Set(edges.value.map((edge) => edge.id));
    let index = 1;
    while (taken.has(`edge-${index}`)) index += 1;
    return `edge-${index}`;
  }

  function addNode(type: NodeType, position?: { x: number; y: number }): void {
    const id = nextNodeId(type);
    const node = createFlowNode(type, position ?? suggestPosition(nodes.value.length), id);
    nodes.value = [...nodes.value, node];
    selectNode(id);
    dirty.value = true;
  }

  function removeNode(id: string): void {
    nodes.value = nodes.value.filter((node) => node.id !== id);
    edges.value = edges.value.filter((edge) => edge.source !== id && edge.target !== id);
    if (selectedNodeId.value === id) selectedNodeId.value = null;
    dirty.value = true;
  }

  function updateNodeConfig(id: string, patch: Record<string, unknown>): void {
    const node = nodes.value.find((item) => item.id === id);
    if (!node) return;
    node.data.config = { ...node.data.config, ...patch };
    dirty.value = true;
  }

  function updateNodeLabel(id: string, label: string): void {
    const node = nodes.value.find((item) => item.id === id);
    if (!node) return;
    node.data.label = label;
    dirty.value = true;
  }

  function connect(connection: Connection): void {
    const source = connection.source;
    const target = connection.target;
    if (!source || !target || source === target) return;
    if (edges.value.some((edge) => edge.source === source && edge.target === target)) return;

    const sourceNode = nodes.value.find((node) => node.id === source);
    const condition = sourceNode?.data.nodeType === 'jev' ? nextCondition(sourceNode, edges.value) : '';

    edges.value = [
      ...edges.value,
      createFlowEdge({
        id: nextEdgeId(),
        source,
        target,
        ...(condition ? { condition } : {}),
      }),
    ];
    dirty.value = true;
  }

  function updateEdgeCondition(edgeId: string, condition: string): void {
    const edge = edges.value.find((item) => item.id === edgeId);
    if (!edge) return;
    const trimmed = condition.trim();
    edge.label = trimmed;
    edge.data = { ...(edge.data ?? {}), condition: trimmed };
    dirty.value = true;
  }

  function removeEdge(edgeId: string): void {
    edges.value = edges.value.filter((edge) => edge.id !== edgeId);
    if (selectedEdgeId.value === edgeId) selectedEdgeId.value = null;
    dirty.value = true;
  }

  function selectNode(id: string): void {
    selectedNodeId.value = id;
    selectedEdgeId.value = null;
  }

  function selectEdge(id: string): void {
    selectedEdgeId.value = id;
    selectedNodeId.value = null;
  }

  function clearSelection(): void {
    selectedNodeId.value = null;
    selectedEdgeId.value = null;
  }

  function selectTrace(index: number): void {
    activeTraceIndex.value = index;
    const entry = trace.value[index];
    if (entry) selectNode(entry.nodeId);
  }

  /** Applies Vue Flow's change batches (drag, delete) back into the store. */
  function applyNodeChanges(changes: NodeChange[]): void {
    for (const change of changes) {
      if (change.type === 'position' && 'position' in change && change.position) {
        const node = nodes.value.find((item) => item.id === change.id);
        if (node) {
          node.position = change.position;
          dirty.value = true;
        }
      } else if (change.type === 'remove') {
        removeNode(change.id);
      }
    }
  }

  function applyEdgeChanges(changes: EdgeChange[]): void {
    for (const change of changes) {
      if (change.type === 'remove') removeEdge(change.id);
    }
  }

  /* --------------------------------- io ---------------------------------- */
  async function save(): Promise<boolean> {
    if (!current.value) return false;
    saving.value = true;
    try {
      const payload = toPayload();
      const saved = isPersisted.value
        ? await workflowApi.update(current.value.id, payload)
        : await workflowApi.create(payload);
      applyWorkflow(saved);
      await refreshList();
      toast.success('toast.saved', { name: saved.name, version: saved.version });
      return true;
    } catch (error) {
      toast.error('toast.saveFailed', { error: errorMessage(error) });
      return false;
    } finally {
      saving.value = false;
    }
  }

  async function remove(): Promise<void> {
    if (!current.value || !isPersisted.value) {
      createNew();
      return;
    }
    const id = current.value.id;
    try {
      await workflowApi.remove(id);
      await refreshList();
      const next = summaries.value[0];
      if (next) await open(next.id);
      else createNew();
      toast.success('toast.workflowRemoved');
    } catch (error) {
      toast.error('toast.workflowRemoveFailed', { error: errorMessage(error) });
    }
  }

  async function run(input: string): Promise<void> {
    if (!current.value) return;

    if (!isPersisted.value) {
      const saved = await save();
      if (!saved || !current.value) return;
    }
    const workflowId = current.value.id;

    running.value = true;
    activeTraceIndex.value = null;
    execution.value = null;
    for (const node of nodes.value) node.data.runStatus = 'running';

    try {
      const response = await workflowApi.run(workflowId, input);
      lastInput.value = input;
      trace.value = response.trace;
      execution.value = {
        id: response.executionId,
        workflowId: response.workflowId,
        status: response.status,
        input: { input },
        output: response.output,
        error: response.error ?? null,
        steps: response.steps,
        startedAt: response.trace[0]?.startedAt ?? '',
        finishedAt: response.trace[response.trace.length - 1]?.finishedAt ?? null,
        durationMs: response.durationMs,
      };
      applyRunStatuses(response.trace);

      if (response.status === 'completed') {
        toast.success('toast.runCompleted', {
          steps: response.steps,
          duration: response.durationMs,
        });
      } else {
        toast.error('toast.runFailed', { error: response.error ?? 'unknown error' });
      }
      const lastIndex = response.trace.length - 1;
      if (lastIndex >= 0) activeTraceIndex.value = lastIndex;
    } catch (error) {
      for (const node of nodes.value) node.data.runStatus = null;
      toast.error('toast.runFailed', { error: errorMessage(error) });
    } finally {
      running.value = false;
    }
  }

  function clearTrace(): void {
    trace.value = [];
    execution.value = null;
    activeTraceIndex.value = null;
    for (const node of nodes.value) node.data.runStatus = null;
  }

  /** Marks each canvas node with the outcome of its last execution. */
  function applyRunStatuses(entries: TraceEntry[]): void {
    const latest = new Map<string, TraceEntry>();
    for (const entry of entries) latest.set(entry.nodeId, entry);
    for (const node of nodes.value) {
      const hit = latest.get(node.id);
      node.data.runStatus = hit ? (hit.status === 'failed' ? 'failed' : 'success') : null;
    }
  }

  /* ----------------------------- serialisation ---------------------------- */
  function toPayload(): WorkflowPayload {
    const workflow = current.value;
    return {
      name: workflow?.name?.trim() || untitledName(),
      description: workflow?.description ?? '',
      nodes: nodes.value.map((node): WorkflowNode => ({
        id: node.id,
        type: node.data.nodeType,
        label: node.data.label,
        position: { x: Math.round(node.position.x), y: Math.round(node.position.y) },
        config: node.data.config,
      })),
      edges: edges.value.map((edge): WorkflowEdge => {
        const condition =
          typeof edge.data?.['condition'] === 'string' ? (edge.data['condition'] as string) : '';
        return {
          id: edge.id,
          source: edge.source,
          target: edge.target,
          ...(condition ? { condition } : {}),
        };
      }),
    };
  }

  return {
    // state
    summaries,
    current,
    nodes,
    edges,
    selectedNodeId,
    selectedEdgeId,
    activeTraceIndex,
    loading,
    saving,
    running,
    dirty,
    trace,
    execution,
    runtime,
    lastInput,
    // getters
    hasWorkflow,
    isPersisted,
    selectedNode,
    selectedEdge,
    outgoingEdgesOfSelected,
    activeTrace,
    runStatus,
    name,
    description,
    // actions
    initialise,
    refreshList,
    open,
    createNew,
    addNode,
    removeNode,
    updateNodeConfig,
    updateNodeLabel,
    connect,
    updateEdgeCondition,
    removeEdge,
    selectNode,
    selectEdge,
    clearSelection,
    selectTrace,
    applyNodeChanges,
    applyEdgeChanges,
    save,
    remove,
    run,
    clearTrace,
  };
});

/* --------------------------------- helpers -------------------------------- */

function createFlowNode(type: NodeType, position: { x: number; y: number }, id: string): FlowNode {
  return {
    id,
    type,
    position: { ...position },
    sourcePosition: Position.Bottom,
    targetPosition: Position.Top,
    data: {
      nodeType: type,
      label: defaultLabel(type),
      config: defaultConfig(type),
      runStatus: null,
    },
  };
}

function toFlowNode(node: WorkflowNode): FlowNode {
  return {
    id: node.id,
    type: node.type,
    position: { ...node.position },
    sourcePosition: Position.Bottom,
    targetPosition: Position.Top,
    data: {
      nodeType: node.type,
      label: node.label?.trim() || defaultLabel(node.type),
      config: { ...(node.config ?? {}) },
      runStatus: null,
    },
  };
}

function createFlowEdge(edge: WorkflowEdge): FlowEdge {
  const condition = edge.condition ?? '';
  return {
    id: edge.id,
    source: edge.source,
    target: edge.target,
    type: 'smoothstep',
    label: condition,
    data: { condition },
    markerEnd: MarkerType.ArrowClosed,
  };
}

function toFlowEdge(edge: WorkflowEdge): FlowEdge {
  return createFlowEdge(edge);
}

function suggestPosition(count: number): { x: number; y: number } {
  return { x: 240 + (count % 3) * 260, y: 120 + Math.floor(count / 3) * 150 };
}

/** Pre-fills a new outgoing edge with the first choice the Jev node has not
 *  wired up yet, so connecting "complete" then "incomplete" just works. */
function nextCondition(node: FlowNode, edges: FlowEdge[]): string {
  const raw = node.data.config['choices'];
  const choices = Array.isArray(raw) ? raw.filter((item): item is string => typeof item === 'string') : [];
  const used = new Set(
    edges.filter((edge) => edge.source === node.id).map((edge) => String(edge.label ?? '')),
  );
  return choices.find((choice) => !used.has(choice)) ?? '';
}
