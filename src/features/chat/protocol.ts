export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
  outputTokens?: number;
}

export interface ChatDocument {
  id: string;
  modelId: string;
  messages: ChatMessage[];
  title?: string;
}

export interface ChatData {
  chat: ChatDocument;
  history: { id: string; title: string }[];
  models: { value: string; label: string; vendor: string }[];
  busy: boolean;
  error?: string;
}

export type ChatRequest =
  | { type: 'send'; content: string; modelId: string }
  | { type: 'open'; id: string }
  | { type: 'delete'; id: string }
  | { type: 'new' }
  | { type: 'copy'; index: number }
  | { type: 'stop' };

export interface ChatUpdate {
  type: 'chatUpdated';
  data: ChatData;
}
