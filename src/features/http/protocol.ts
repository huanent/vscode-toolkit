export interface HttpRequestData {
  name?: string;
  method: string;
  url: string;
  headers: Record<string, string>;
  body?: string;
}

export interface HttpResponseData {
  status: number;
  statusText: string;
  headers: Record<string, string>;
  body: string;
  formattedBody?: string;
  isJson: boolean;
  durationMs: number;
  sizeBytes: number;
  timestamp: number;
  request: HttpRequestData;
}

export interface HttpErrorData {
  message: string;
  durationMs?: number;
  timestamp: number;
  request: HttpRequestData;
}

export type HttpResultState =
  | { status: 'idle' }
  | { status: 'pending'; request: HttpRequestData; timestamp: number }
  | { status: 'success'; response: HttpResponseData }
  | { status: 'error'; error: HttpErrorData };

export type ResultHostMessage =
  | { type: 'loaded'; data: HttpResultState }
  | { type: 'resultStateUpdated'; state: HttpResultState };

export type ResultWebviewMessage =
  | { type: 'ready' }
  | { type: 'copyToClipboard'; text: string }
  | { type: 'openInEditor'; content: string; language?: string }
  | { type: 'rerunRequest' };
