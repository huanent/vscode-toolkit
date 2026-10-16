export interface HttpClientSettings {
  baseUrl: string;
  headers: Record<string, string>;
  authType: 'none' | 'basic' | 'bearer' | 'apiKey';
  apiKeyName: string;
  apiKeyLocation: 'header' | 'query';
  timeoutMs: number;
}

export interface HttpClientRequest {
  id: string;
  path: string;
  method?: string;
  headers?: Record<string, string>;
  query?: Record<string, string>;
  body?: string;
}

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
