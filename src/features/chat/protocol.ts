export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
  /** Tokens in the prompt sent with the request that produced this message. */
  inputTokens?: number;
  outputTokens?: number;
}

export interface ChatDocument {
  id: string;
  modelId: string;
  messages: ChatMessage[];
  title?: string;
}

export interface ChatModelOption {
  /** Unique identifier combining vendor and model ID, used for selection and persistence. */
  value: string;
  label: string;
  vendor: string;
  /** Provider-specific model ID, shown when labels are ambiguous. */
  id: string;
}

export interface ChatData {
  chat: ChatDocument;
  history: { id: string; title: string }[];
  models: ChatModelOption[];
  busy: boolean;
  error?: string;
}

export type ChatRequest =
  | { type: 'send'; content: string; modelId: string; index?: number }
  | { type: 'selectModel'; modelId: string }
  | { type: 'open'; id: string }
  | { type: 'delete'; id: string }
  | { type: 'new' }
  | { type: 'copy'; index: number }
  | { type: 'share' }
  | { type: 'regenerate'; modelId: string }
  | { type: 'stop' };

export interface ChatUpdate {
  type: 'chatUpdated';
  data: ChatData;
}
