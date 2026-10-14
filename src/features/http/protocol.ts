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
