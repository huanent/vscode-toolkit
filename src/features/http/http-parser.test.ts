import { describe, expect, it } from 'vitest';
import {
  buildHttpRequestData,
  findRequestAtLine,
  parseFileVariables,
  parseHttpDocument,
  resolveSystemVariable,
  substituteVariables,
} from './http-parser';

describe('HTTP Document Parser', () => {
  it('parses file variables correctly', () => {
    const text = ['@baseUrl = https://example.com/api', '@token=secret-token-123', '# comment', '@port = 8080'].join(
      '\n',
    );

    const vars = parseFileVariables(text);
    expect(vars.get('baseUrl')).toBe('https://example.com/api');
    expect(vars.get('@baseUrl')).toBe('https://example.com/api');
    expect(vars.get('token')).toBe('secret-token-123');
    expect(vars.get('port')).toBe('8080');
  });

  it('substitutes user variables and system variables', () => {
    const vars = new Map([
      ['host', 'httpbin.org'],
      ['id', '42'],
    ]);

    const result = substituteVariables('https://{{host}}/get?id={{id}}&uuid={{$guid}}', vars);
    expect(result).toMatch(/^https:\/\/httpbin\.org\/get\?id=42&uuid=[0-9a-f-]+$/);
  });

  it('resolves system variables such as timestamp, datetime, randomInt', () => {
    expect(resolveSystemVariable('$guid')).toMatch(/^[0-9a-f-]{36}$/);
    expect(resolveSystemVariable('$timestamp')).toMatch(/^\d+$/);
    expect(resolveSystemVariable('$timestamp 100')).toMatch(/^\d+$/);
    expect(resolveSystemVariable('$datetime rfc1123')).toBeDefined();
    expect(resolveSystemVariable('$randomInt 10 20')).toMatch(/^\d+$/);
  });

  it('parses multiple requests with directives, headers, multiline query params, and bodies', () => {
    const doc = [
      '@host = https://api.example.com',
      '',
      '### Get Profile',
      '# @name getProfile',
      'GET {{host}}/profile',
      '  ?status=active',
      '  &page=1',
      'Authorization: Bearer token123',
      'Accept: application/json',
      '',
      '### Create Profile',
      'POST {{host}}/profile HTTP/1.1',
      'Content-Type: application/json',
      '',
      '{',
      '  "name": "Alice",',
      '  "age": 30',
      '}',
    ].join('\n');

    const requests = parseHttpDocument(doc);
    expect(requests.length).toBe(2);

    // Request 1
    const req1 = requests[0];
    expect(req1.name).toBe('Get Profile');
    expect(req1.method).toBe('GET');
    expect(req1.url).toBe('{{host}}/profile?status=active&page=1');
    expect(req1.headers['Authorization']).toBe('Bearer token123');
    expect(req1.headers['Accept']).toBe('application/json');
    expect(req1.body).toBeUndefined();

    // Request 2
    const req2 = requests[1];
    expect(req2.name).toBe('Create Profile');
    expect(req2.method).toBe('POST');
    expect(req2.url).toBe('{{host}}/profile');
    expect(req2.headers['Content-Type']).toBe('application/json');
    expect(req2.body).toBe('{\n  "name": "Alice",\n  "age": 30\n}');

    // Build data with variable substitution
    const vars = parseFileVariables(doc);
    const data1 = buildHttpRequestData(req1, vars);
    expect(data1.url).toBe('https://api.example.com/profile?status=active&page=1');
  });

  it('finds the correct request for a given line', () => {
    const doc = [
      '### Req 1',
      'GET https://example.com/1',
      '',
      '### Req 2',
      'POST https://example.com/2',
      '',
      'body',
    ].join('\n');

    const requests = parseHttpDocument(doc);
    expect(findRequestAtLine(requests, 1)?.url).toBe('https://example.com/1');
    expect(findRequestAtLine(requests, 5)?.url).toBe('https://example.com/2');
  });
});
