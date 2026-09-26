import { http } from './client.js';
import type {
  ExecutionDetail,
  RunResponse,
  RuntimeInfo,
  TraceEntry,
  Workflow,
  WorkflowPayload,
  WorkflowSummary,
} from '@/types';

export const workflowApi = {
  async list(): Promise<WorkflowSummary[]> {
    const { data } = await http.get<{ workflows: WorkflowSummary[] }>('/workflows');
    return data.workflows;
  },

  async get(id: string): Promise<Workflow> {
    const { data } = await http.get<{ workflow: Workflow }>(`/workflows/${id}`);
    return data.workflow;
  },

  async create(payload: WorkflowPayload): Promise<Workflow> {
    const { data } = await http.post<{ workflow: Workflow }>('/workflows', payload);
    return data.workflow;
  },

  async update(id: string, payload: WorkflowPayload): Promise<Workflow> {
    const { data } = await http.put<{ workflow: Workflow }>(`/workflows/${id}`, payload);
    return data.workflow;
  },

  async remove(id: string): Promise<void> {
    await http.delete(`/workflows/${id}`);
  },

  async run(id: string, input: string): Promise<RunResponse> {
    const { data } = await http.post<RunResponse>(`/workflows/${id}/run`, { input });
    return data;
  },
};

export const executionApi = {
  async get(id: string): Promise<ExecutionDetail> {
    const { data } = await http.get<ExecutionDetail>(`/executions/${id}`);
    return data;
  },

  async nodes(id: string): Promise<TraceEntry[]> {
    const { data } = await http.get<{ nodes: TraceEntry[] }>(`/executions/${id}/nodes`);
    return data.nodes;
  },
};

export const runtimeApi = {
  async info(): Promise<RuntimeInfo> {
    const { data } = await http.get<RuntimeInfo>('/runtime');
    return data;
  },
};
