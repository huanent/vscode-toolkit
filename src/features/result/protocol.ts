export type ResultTaskStatus = 'running' | 'completed' | 'failed' | 'cancelled' | 'interrupted';

export interface ResultTask {
  id: string;
  kind: string;
  title: string;
  status: ResultTaskStatus;
  createdAt: number;
  updatedAt: number;
  input?: unknown;
  output?: unknown;
  error?: string;
}

export type ResultTaskSummary = Pick<ResultTask, 'id' | 'kind' | 'title' | 'status' | 'createdAt' | 'updatedAt'>;

export interface ResultViewState {
  tasks: ResultTaskSummary[];
  selectedTask?: ResultTask;
}

export type ResultHostMessage = { type: 'resultStateUpdated'; state: ResultViewState };

export type ResultWebviewMessage =
  | { type: 'copyToClipboard'; text: string }
  | { type: 'openInEditor'; content: string; language?: string }
  | { type: 'selectTask'; taskId: string }
  | { type: 'terminateTask'; taskId: string }
  | { type: 'deleteTask'; taskId: string };
