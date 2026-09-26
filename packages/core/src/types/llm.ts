/** LLM layer types. Mirrors the OpenAI chat-completions shape on purpose. */

export interface LLMRequest {
  /** The user prompt, already template-resolved. */
  prompt: string;
  /** Optional system prompt, already template-resolved. */
  systemPrompt?: string;
  model?: string;
  temperature?: number;
  maxTokens?: number;
  /** Non-prompt context (workflow id, node id, variables...) for clients that care. */
  context?: unknown;
}

export interface LLMUsage {
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
}

export interface LLMResponse {
  content: string;
  model: string;
  usage?: LLMUsage;
}

/** The generation contract. Mock and real providers both implement it. */
export interface LLMClient {
  readonly name: string;
  complete(request: LLMRequest): Promise<LLMResponse>;
}
