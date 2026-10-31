import type { HttpRequestData, HttpResponseData } from './protocol';
import { applyEdits, format, parse, type ParseError } from 'jsonc-parser';

export interface ExecuteOptions {
  timeoutMs?: number;
  signal?: AbortSignal;
  redirect?: 'follow' | 'error' | 'manual';
}

export async function executeHttpRequest(
  request: HttpRequestData,
  options: ExecuteOptions = {},
): Promise<HttpResponseData> {
  const timeoutMs = options.timeoutMs ?? 60_000;
  const controller = new AbortController();
  const abortFromCaller = () => controller.abort(options.signal?.reason);
  if (options.signal?.aborted) abortFromCaller();
  else options.signal?.addEventListener('abort', abortFromCaller, { once: true });
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  const startTime = performance.now();
  try {
    const method = request.method.toUpperCase();
    const canHaveBody = method !== 'GET' && method !== 'HEAD';

    const init: RequestInit = {
      method,
      headers: request.headers,
      signal: controller.signal,
      redirect: options.redirect ?? 'follow',
    };

    if (canHaveBody && request.body !== undefined) {
      init.body = request.body;
    }

    const res = await fetch(request.url, init);
    const rawBody = await res.text();
    const durationMs = Math.round(performance.now() - startTime);

    const headers: Record<string, string> = {};
    res.headers.forEach((value, key) => {
      headers[key.toLowerCase()] = value;
    });

    let isJson = false;
    let formattedBody: string | undefined;

    const contentType = headers['content-type'] ?? '';
    if (contentType.includes('json') || rawBody.trim().startsWith('{') || rawBody.trim().startsWith('[')) {
      const errors: ParseError[] = [];
      parse(rawBody, errors, { disallowComments: true });
      if (!errors.length && rawBody.trim()) {
        formattedBody = applyEdits(rawBody, format(rawBody, undefined, { insertSpaces: true, tabSize: 2, eol: '\n' }));
        isJson = true;
      }
    }

    const sizeBytes = new TextEncoder().encode(rawBody).length;

    return {
      status: res.status,
      statusText: res.statusText || String(res.status),
      headers,
      body: rawBody,
      formattedBody,
      isJson,
      durationMs,
      sizeBytes,
      timestamp: Date.now(),
      request,
    };
  } finally {
    clearTimeout(timeoutId);
    options.signal?.removeEventListener('abort', abortFromCaller);
  }
}
