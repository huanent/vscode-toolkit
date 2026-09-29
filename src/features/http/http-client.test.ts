import { afterEach, describe, expect, it, vi } from 'vitest';
import { executeHttpRequest } from './http-client';
import type { HttpRequestData } from './protocol';

describe('HTTP Client Execution', () => {
  const originalFetch = globalThis.fetch;

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it('sends GET request and parses JSON response successfully', async () => {
    const mockHeaders = new Headers();
    mockHeaders.set('content-type', 'application/json; charset=utf-8');

    globalThis.fetch = vi.fn<typeof fetch>(
      async () =>
        ({
          status: 200,
          statusText: 'OK',
          headers: mockHeaders,
          text: async () => JSON.stringify({ message: 'hello', success: true }),
        }) as unknown as Response,
    );

    const req: HttpRequestData = {
      method: 'GET',
      url: 'https://api.example.com/data',
      headers: { accept: 'application/json' },
    };

    const res = await executeHttpRequest(req);
    expect(res.status).toBe(200);
    expect(res.isJson).toBe(true);
    expect(res.formattedBody).toContain('"message": "hello"');
    expect(res.request.url).toBe('https://api.example.com/data');
  });

  it('sends POST request with body', async () => {
    let capturedInit: RequestInit | undefined;

    globalThis.fetch = vi.fn<typeof fetch>(async (_input: RequestInfo | URL, init?: RequestInit) => {
      capturedInit = init;
      return {
        status: 201,
        statusText: 'Created',
        headers: new Headers(),
        text: async () => 'Created successfully',
      } as unknown as Response;
    });

    const req: HttpRequestData = {
      method: 'POST',
      url: 'https://api.example.com/create',
      headers: { 'content-type': 'application/json' },
      body: '{"foo":"bar"}',
    };

    const res = await executeHttpRequest(req);
    expect(res.status).toBe(201);
    expect(capturedInit?.method).toBe('POST');
    expect(capturedInit?.body).toBe('{"foo":"bar"}');
    expect(res.isJson).toBe(false);
  });
});
