import * as vscode from 'vscode';

export interface HttpResult {
	method: string;
	url: string;
	state: 'loading' | 'success' | 'error' | 'cancelled';
	status?: number;
	statusText?: string;
	elapsed?: number;
	headers?: [string, string][];
	body?: string;
	message?: string;
}

export class HttpResultPanel implements vscode.WebviewViewProvider {
	static readonly viewType = 'vscode-toolkit.httpResult';
	private static readonly visibleContext = 'vscode-toolkit.httpResultVisible';
	private view: vscode.WebviewView | undefined;
	private result: HttpResult | undefined;

	resolveWebviewView(webviewView: vscode.WebviewView): void {
		this.view = webviewView;
		webviewView.webview.html = this.getHtml(this.result);
		webviewView.onDidChangeVisibility(() => {
			if (!webviewView.visible) {
				void vscode.commands.executeCommand('setContext', HttpResultPanel.visibleContext, false);
			}
		});
		webviewView.onDidDispose(() => {
			this.view = undefined;
		});
	}

	async show(result: HttpResult): Promise<void> {
		this.result = result;
		await vscode.commands.executeCommand('setContext', HttpResultPanel.visibleContext, true);
		if (this.view) {
			this.view.webview.html = this.getHtml(result);
			this.view.show(true);
			return;
		}

		await vscode.commands.executeCommand(`${HttpResultPanel.viewType}.focus`);
	}

	private getHtml(result: HttpResult | undefined): string {
		const content = result ? renderResult(result) : '';
		return `<!DOCTYPE html>
<html lang="en">
<head>
	<meta charset="UTF-8">
	<meta name="viewport" content="width=device-width, initial-scale=1.0">
	<style>
		* { box-sizing: border-box; }
		body {
			margin: 0;
			color: var(--vscode-editor-foreground);
			background: var(--vscode-editor-background);
			font-family: var(--vscode-font-family);
			font-size: var(--vscode-font-size);
		}
		.request {
			display: flex;
			align-items: center;
			gap: 10px;
			min-height: 42px;
			padding: 8px 14px;
			border-bottom: 1px solid var(--vscode-panel-border);
		}
		.method, .status {
			flex: none;
			font-weight: 600;
		}
		.method { color: var(--vscode-symbolIcon-functionForeground); }
		.url {
			min-width: 0;
			overflow: hidden;
			color: var(--vscode-textLink-foreground);
			font-family: var(--vscode-editor-font-family);
			text-overflow: ellipsis;
			white-space: nowrap;
		}
		.meta {
			display: flex;
			align-items: center;
			gap: 12px;
			margin-left: auto;
			white-space: nowrap;
		}
		.status.success { color: var(--vscode-testing-iconPassed); }
		.status.redirect { color: var(--vscode-editorWarning-foreground); }
		.status.failure { color: var(--vscode-testing-iconFailed); }
		.elapsed { color: var(--vscode-descriptionForeground); }
		.content { padding: 12px 14px 18px; }
		details { margin-bottom: 12px; }
		summary {
			cursor: pointer;
			color: var(--vscode-descriptionForeground);
			font-size: 12px;
			font-weight: 600;
			user-select: none;
		}
		.headers {
			display: grid;
			grid-template-columns: minmax(120px, max-content) 1fr;
			gap: 4px 18px;
			margin-top: 10px;
			font-family: var(--vscode-editor-font-family);
			font-size: var(--vscode-editor-font-size);
		}
		.header-name { color: var(--vscode-symbolIcon-propertyForeground); }
		.header-value { min-width: 0; overflow-wrap: anywhere; }
		.body-label {
			margin-bottom: 8px;
			color: var(--vscode-descriptionForeground);
			font-size: 12px;
			font-weight: 600;
		}
		pre {
			margin: 0;
			padding: 10px 12px;
			border: 1px solid var(--vscode-panel-border);
			border-radius: 4px;
			background: var(--vscode-textCodeBlock-background);
			white-space: pre-wrap;
			overflow-wrap: anywhere;
			font-family: var(--vscode-editor-font-family);
			font-size: var(--vscode-editor-font-size);
			line-height: 1.5;
		}
		.message {
			display: flex;
			align-items: center;
			gap: 8px;
			padding: 14px;
			color: var(--vscode-descriptionForeground);
		}
		.message.error { color: var(--vscode-errorForeground); }
		.spinner {
			width: 13px;
			height: 13px;
			border: 2px solid var(--vscode-progressBar-background);
			border-right-color: transparent;
			border-radius: 50%;
			animation: spin .8s linear infinite;
		}
		@keyframes spin { to { transform: rotate(360deg); } }
		@media (max-width: 520px) {
			.request { align-items: flex-start; flex-wrap: wrap; }
			.url { order: 3; width: 100%; }
			.meta { margin-left: auto; }
			.headers { grid-template-columns: 1fr; gap: 2px; }
			.header-value { margin-bottom: 6px; }
		}
	</style>
</head>
<body>
	${content}
</body>
</html>`;
	}
}

function renderResult(result: HttpResult): string {
	const request = `<header class="request">
	<span class="method">${escapeHtml(result.method)}</span>
	<span class="url" title="${escapeAttribute(result.url)}">${escapeHtml(result.url)}</span>
	${renderMeta(result)}
</header>`;

	if (result.state === 'loading') {
		return `${request}<div class="message"><span class="spinner"></span>Sending request...</div>`;
	}
	if (result.state === 'error' || result.state === 'cancelled') {
		const className = result.state === 'error' ? 'message error' : 'message';
		return `${request}<div class="${className}">${escapeHtml(result.message ?? '')}</div>`;
	}

	const headers = (result.headers ?? [])
		.map(
			([name, value]) =>
				`<span class="header-name">${escapeHtml(name)}</span><span class="header-value">${escapeHtml(value)}</span>`,
		)
		.join('');
	return `${request}<main class="content">
	<details><summary>Response headers (${result.headers?.length ?? 0})</summary><div class="headers">${headers}</div></details>
	<div class="body-label">Response body</div>
	<pre>${escapeHtml(result.body || '(empty response)')}</pre>
</main>`;
}

function renderMeta(result: HttpResult): string {
	if (result.status === undefined) {
		return '';
	}
	const statusClass =
		result.status < 300 ? 'success' : result.status < 400 ? 'redirect' : 'failure';
	return `<span class="meta"><span class="status ${statusClass}">${result.status} ${escapeHtml(result.statusText ?? '')}</span><span class="elapsed">${result.elapsed} ms</span></span>`;
}

function escapeHtml(value: string): string {
	return value.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;');
}

function escapeAttribute(value: string): string {
	return escapeHtml(value).replaceAll('"', '&quot;');
}
