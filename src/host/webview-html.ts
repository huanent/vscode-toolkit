import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import * as vscode from 'vscode';

export interface WebviewHtmlOptions {
  /** Page directory name under `src/webview/pages`, which also names the built entry under `dist`. */
  page: string;
  title?: string;
  /** Values exposed on the root element as `data-*` attributes, readable through `getRootData`. */
  data?: Record<string, string>;
}

/**
 * Builds the HTML for a built webview page. It rewrites the root-absolute asset URLs
 * emitted by Vite, applies the content security policy, and exposes host data on the
 * root element. Shared by webview views and custom editors so each page stays declarative.
 */
export function getWebviewHtml(webview: vscode.Webview, assetsUri: vscode.Uri, options: WebviewHtmlOptions): string {
  const { page } = options;
  const asset = (relativePath: string) =>
    webview.asWebviewUri(vscode.Uri.joinPath(assetsUri, ...relativePath.split('/'))).toString();

  let html = readFileSync(join(assetsUri.fsPath, page, 'index.html'), 'utf8');
  html = html.replace(/\b(src|href)="\/([^"]+)"/g, (_match, attribute: string, path: string) => {
    return `${attribute}="${asset(path)}"`;
  });

  if (options.title) {
    html = html.replace(/<title>.*?<\/title>/, `<title>${escapeHtml(options.title)}</title>`);
  }

  const dataAttributes = Object.entries(options.data ?? {})
    .map(([name, value]) => ` data-${toKebabCase(name)}="${escapeHtml(value)}"`)
    .join('');
  if (dataAttributes) {
    html = html.replace('<div id="root"></div>', `<div id="root"${dataAttributes}></div>`);
  }

  return html.replace(
    '</head>',
    `<meta http-equiv="Content-Security-Policy" content="${contentSecurityPolicy(webview)}"></head>`,
  );
}

function contentSecurityPolicy(webview: vscode.Webview): string {
  return [
    "default-src 'none'",
    `img-src ${webview.cspSource} data:`,
    `font-src ${webview.cspSource}`,
    `script-src ${webview.cspSource}`,
    `style-src ${webview.cspSource}`,
  ].join('; ');
}

function toKebabCase(value: string): string {
  return value.replace(/[A-Z]/g, (character) => `-${character.toLowerCase()}`);
}

function escapeHtml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;');
}
