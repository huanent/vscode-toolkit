import type { HttpRequestData } from './protocol';

const variablePattern = /^\s*(@[a-zA-Z0-9_.-]+)\s*=\s*(.*)$/;
const separatorPattern = /^\s*###+\s*(.*)$/;
const directivePattern = /^\s*#\s*@name\s+(\S+)/i;
const requestLinePattern =
  /^\s*(GET|POST|PUT|DELETE|PATCH|HEAD|OPTIONS|CONNECT|TRACE)\s+(\S+)(?:\s+HTTP\/[0-9.]+)?\s*$/i;
const defaultGetPattern = /^\s*(https?:\/\/\S+)(?:\s+HTTP\/[0-9.]+)?\s*$/i;
const headerPattern = /^([a-zA-Z0-9_-]+)\s*:\s*(.*)$/;

export interface ParsedRequest {
  name?: string;
  startLine: number;
  endLine: number;
  requestLineNumber: number;
  method: string;
  url: string;
  headers: Record<string, string>;
  invalidHeaderLines: number[];
  body?: string;
}

export function parseFileVariables(text: string): Map<string, string> {
  const variables = new Map<string, string>();
  const lines = text.split(/\r?\n/);

  for (const line of lines) {
    const match = line.match(variablePattern);
    if (match) {
      const rawName = match[1];
      const nameWithoutAt = rawName.startsWith('@') ? rawName.slice(1) : rawName;
      const val = match[2].trim();
      variables.set(rawName, val);
      variables.set(nameWithoutAt, val);
    }
  }

  return variables;
}

export function resolveSystemVariable(expression: string): string | undefined {
  const trimmed = expression.trim();

  if (trimmed === '$guid') {
    return typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
      ? crypto.randomUUID()
      : '00000000-0000-0000-0000-000000000000';
  }

  if (trimmed.startsWith('$timestamp')) {
    const parts = trimmed.split(/\s+/);
    let seconds = Math.floor(Date.now() / 1000);
    if (parts.length >= 2) {
      const offset = parseInt(parts[1], 10);
      if (!Number.isNaN(offset)) {
        seconds += offset;
      }
    }
    return String(seconds);
  }

  if (trimmed.startsWith('$datetime')) {
    const parts = trimmed.split(/\s+/);
    const format = parts[1]?.toLowerCase();
    const now = new Date();
    if (format === 'rfc1123') {
      return now.toUTCString();
    }
    return now.toISOString();
  }

  if (trimmed.startsWith('$randomInt')) {
    const parts = trimmed.split(/\s+/);
    const min = parseInt(parts[1], 10) || 0;
    const max = parseInt(parts[2], 10) || 1000;
    const val = Math.floor(Math.random() * (max - min + 1)) + min;
    return String(val);
  }

  if (trimmed.startsWith('$processEnv')) {
    const parts = trimmed.split(/\s+/);
    const varName = parts[1];
    return varName ? process.env[varName] : undefined;
  }

  return undefined;
}

export function substituteVariables(text: string, variables: Map<string, string>): string {
  return text.replace(/\{\{([^}]+)\}\}/g, (match, rawExpr: string) => {
    const expr = rawExpr.trim();
    if (expr.startsWith('$')) {
      const sysVal = resolveSystemVariable(expr);
      if (sysVal !== undefined) return sysVal;
    }

    if (variables.has(expr)) {
      return variables.get(expr)!;
    }

    const withoutAt = expr.startsWith('@') ? expr.slice(1) : `@${expr}`;
    if (variables.has(withoutAt)) {
      return variables.get(withoutAt)!;
    }

    return match;
  });
}

export function isHttpVariableDefined(expression: string, variables: Map<string, string>): boolean {
  const name = expression.trim();
  if (name.startsWith('$')) {
    if (/^\$processEnv(?:\s|$)/.test(name)) {
      const envName = name.split(/\s+/)[1];
      return !!envName && process.env[envName] !== undefined;
    }
    return /^\$(guid|timestamp|datetime|randomInt)(?:\s|$)/.test(name);
  }
  return variables.has(name) || variables.has(name.startsWith('@') ? name.slice(1) : `@${name}`);
}

export function parseHttpDocument(content: string): ParsedRequest[] {
  const lines = content.split(/\r?\n/);
  const requests: ParsedRequest[] = [];

  // 1. Collect sections demarcated by ###
  interface Section {
    startLine: number;
    endLine: number;
    separatorTitle?: string;
    lines: string[];
  }

  const sections: Section[] = [];
  let currentSection: Section | null = null;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const sepMatch = line.match(separatorPattern);

    if (sepMatch) {
      if (currentSection) {
        currentSection.endLine = i - 1;
        sections.push(currentSection);
      }
      currentSection = {
        startLine: i,
        endLine: i,
        separatorTitle: sepMatch[1]?.trim() || undefined,
        lines: [line],
      };
    } else {
      if (!currentSection) {
        currentSection = {
          startLine: i,
          endLine: i,
          lines: [line],
        };
      } else {
        currentSection.endLine = i;
        currentSection.lines.push(line);
      }
    }
  }

  if (currentSection) {
    sections.push(currentSection);
  }

  // 2. Parse each section to find a request line
  for (const section of sections) {
    let name: string | undefined = section.separatorTitle;
    let requestLineIndex = -1;
    let method = 'GET';
    let url = '';

    for (let j = 0; j < section.lines.length; j++) {
      const line = section.lines[j];

      const dirMatch = line.match(directivePattern);
      if (dirMatch && !name) {
        name = dirMatch[1].trim();
      }

      const reqMatch = line.match(requestLinePattern);
      if (reqMatch) {
        requestLineIndex = j;
        method = reqMatch[1].toUpperCase();
        url = reqMatch[2];
        break;
      }

      const getMatch = line.match(defaultGetPattern);
      if (getMatch) {
        requestLineIndex = j;
        method = 'GET';
        url = getMatch[1];
        break;
      }
    }

    if (requestLineIndex === -1) {
      continue;
    }

    // Support multiline URL query parameters immediately following the request line
    let currentIndex = requestLineIndex + 1;
    while (currentIndex < section.lines.length) {
      const line = section.lines[currentIndex].trim();
      if (line.startsWith('?') || line.startsWith('&')) {
        url += line;
        currentIndex++;
      } else {
        break;
      }
    }

    // Parse headers until empty line
    const headers: Record<string, string> = {};
    const invalidHeaderLines: number[] = [];
    while (currentIndex < section.lines.length) {
      const line = section.lines[currentIndex];
      const trimmed = line.trim();

      if (trimmed === '') {
        currentIndex++;
        break;
      }

      if (trimmed.startsWith('#') || trimmed.startsWith('//')) {
        currentIndex++;
        continue;
      }

      const headerMatch = line.match(headerPattern);
      if (headerMatch) {
        headers[headerMatch[1].trim()] = headerMatch[2].trim();
      } else {
        invalidHeaderLines.push(section.startLine + currentIndex);
      }

      currentIndex++;
    }

    // Everything remaining is body
    const bodyLines: string[] = [];
    while (currentIndex < section.lines.length) {
      bodyLines.push(section.lines[currentIndex]);
      currentIndex++;
    }

    while (bodyLines.length > 0 && bodyLines[bodyLines.length - 1].trim() === '') {
      bodyLines.pop();
    }

    const body = bodyLines.length > 0 ? bodyLines.join('\n') : undefined;

    requests.push({
      name,
      startLine: section.startLine,
      endLine: section.endLine,
      requestLineNumber: section.startLine + requestLineIndex,
      method,
      url,
      headers,
      invalidHeaderLines,
      body,
    });
  }

  return requests;
}

export function buildHttpRequestData(request: ParsedRequest, variables: Map<string, string>): HttpRequestData {
  if (request.invalidHeaderLines.length) {
    throw new Error(`Invalid HTTP header at line ${request.invalidHeaderLines[0] + 1}.`);
  }
  const resolve = (value: string): string => {
    const unresolved: string[] = [];
    const result = value.replace(/\{\{([^}]+)\}\}/g, (match, expression: string) => {
      const resolved = substituteVariables(match, variables);
      if (!isHttpVariableDefined(expression, variables)) unresolved.push(expression.trim());
      return resolved;
    });
    if (unresolved.length) throw new Error(`Undefined HTTP variables: ${unresolved.join(', ')}`);
    return result;
  };
  let resolvedUrl = resolve(request.url).trim();
  if (!/^https?:\/\//i.test(resolvedUrl)) {
    resolvedUrl = `http://${resolvedUrl}`;
  }

  const resolvedHeaders: Record<string, string> = {};
  for (const [key, value] of Object.entries(request.headers)) {
    resolvedHeaders[key] = resolve(value);
  }

  const resolvedBody = request.body ? resolve(request.body) : undefined;

  return {
    name: request.name,
    method: request.method,
    url: resolvedUrl,
    headers: resolvedHeaders,
    body: resolvedBody,
  };
}

export function findRequestAtLine(requests: ParsedRequest[], targetLine: number): ParsedRequest | undefined {
  return requests.find((request) => targetLine >= request.startLine && targetLine <= request.endLine);
}
