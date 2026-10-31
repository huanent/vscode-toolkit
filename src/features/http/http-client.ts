import type { HttpRequestData, HttpResponseData } from './protocol';
import { applyEdits, format, parse, type ParseError } from 'jsonc-parser';

export interface ExecuteOptions {
  timeoutMs?: number;
  signal?: AbortSignal;
  redirect?: 'follow' | 'error' | 'manual';
  maxResponseBytes?: number;
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
    if (!canHaveBody && request.body !== undefined) {
      throw new Error(`${method} requests cannot have a body.`);
    }

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
    const maxResponseBytes = options.maxResponseBytes ?? 10 * 1024 * 1024;
    const reader = res.body?.getReader();
    const chunks: Uint8Array[] = [];
    let sizeBytes = 0;
    if (reader) {
      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          sizeBytes += value.byteLength;
          if (sizeBytes > maxResponseBytes) {
            await reader.cancel();
            throw new Error(`HTTP response exceeds the ${maxResponseBytes} byte limit.`);
          }
          chunks.push(value);
        }
      } finally {
        reader.releaseLock();
      }
    }
    const decoder = new TextDecoder();
    const rawBody = chunks.map((chunk) => decoder.decode(chunk, { stream: true })).join('') + decoder.decode();
    const durationMs = Math.round(performance.now() - startTime);

    const headers: Record<string, string> = {};
    res.headers.forEach((value, key) => {
      headers[key.toLowerCase()] = value;
    });

    let isJson = false;
    let formattedBody: string | undefined;

    const contentType = headers['content-type'] ?? '';
    const mediaType = contentType.split(';', 1)[0].trim().toLowerCase();
    const isBinary =
      !!mediaType &&
      !/^(text\/|application\/(?:json|[^/]+\+json|xml|[^/]+\+xml|javascript|x-www-form-urlencoded))/.test(mediaType);
    const binaryBody = isBinary ? Buffer.concat(chunks, sizeBytes).toString('base64') : undefined;
    if (contentType.includes('json') || rawBody.trim().startsWith('{') || rawBody.trim().startsWith('[')) {
      const errors: ParseError[] = [];
      parse(rawBody, errors, { disallowComments: true });
      if (!errors.length && rawBody.trim()) {
        formattedBody = applyEdits(rawBody, format(rawBody, undefined, { insertSpaces: true, tabSize: 2, eol: '\n' }));
        isJson = true;
      }
    }

    return {
      status: res.status,
      statusText: res.statusText || String(res.status),
      headers,
      body: rawBody,
      binaryBody,
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
