import * as vscode from 'vscode';
import { registerHttpFormatter } from './httpFormatter';
import {
	HTTP_METHODS,
	HttpLanguageService,
	registerHttpHoverProvider,
	registerHttpLanguageDiagnostics,
} from './httpLanguageService';
import type { Result } from '../result/protocol';
import type { ResultView } from '../result/resultView';

const headers = [
	['Accept', 'application/json'],
	['Authorization', 'Bearer ${1:token}'],
	['Content-Type', 'application/json'],
	['User-Agent', 'Toolkit HTTP Client'],
	['Cache-Control', 'no-cache'],
];
const languageService = new HttpLanguageService();

export function registerHttpClient(context: vscode.ExtensionContext, resultView: ResultView): void {
	const requestStatus = new HttpRequestStatus();
	const selector: vscode.DocumentSelector = { language: 'http' };

	context.subscriptions.push(
		requestStatus,
		vscode.commands.registerCommand(
			'vscode-toolkit.sendHttpRequest',
			async (uri?: vscode.Uri, line?: number) => {
				await sendRequest(resultView, requestStatus, uri, line);
			},
		),
		vscode.languages.registerCodeLensProvider(selector, new HttpCodeLensProvider()),
		vscode.languages.registerCompletionItemProvider(
			selector,
			new HttpCompletionProvider(),
			'{',
			':',
			'@',
		),
		registerHttpHoverProvider(languageService),
		registerHttpFormatter(),
	);
	registerHttpLanguageDiagnostics(context, languageService);
}

class HttpRequestStatus implements vscode.Disposable {
	private readonly sendingItem = vscode.window.createStatusBarItem(
		vscode.StatusBarAlignment.Left,
		Number.MIN_SAFE_INTEGER,
	);
	private readonly controllers = new Set<AbortController>();

	constructor() {
		this.sendingItem.name = 'Toolkit HTTP Request';
		this.sendingItem.tooltip = 'HTTP request in progress';
	}

	start(controller: AbortController, method: string): void {
		this.controllers.add(controller);
		this.sendingItem.text = `HTTP ${method} $(sync~spin)`;
		this.sendingItem.show();
	}

	finish(controller: AbortController): void {
		this.controllers.delete(controller);
		if (this.controllers.size === 0) {
			this.sendingItem.hide();
		}
	}

	private cancel(): void {
		for (const controller of this.controllers) {
			controller.abort();
		}
	}

	dispose(): void {
		this.cancel();
		this.sendingItem.dispose();
	}
}

class HttpCodeLensProvider implements vscode.CodeLensProvider {
	provideCodeLenses(document: vscode.TextDocument): vscode.CodeLens[] {
		const lenses: vscode.CodeLens[] = [];
		const contexts = languageService.getLineContexts(document);
		for (let line = 0; line < document.lineCount; line++) {
			if (
				contexts[line] !== 'request' ||
				!languageService.parseRequestLine(document.lineAt(line).text)
			) {
				continue;
			}

			lenses.push(
				new vscode.CodeLens(document.lineAt(line).range, {
					title: '$(play) Send Request',
					command: 'vscode-toolkit.sendHttpRequest',
					arguments: [document.uri, line],
				}),
			);
		}
		return lenses;
	}
}

class HttpCompletionProvider implements vscode.CompletionItemProvider {
	provideCompletionItems(
		document: vscode.TextDocument,
		position: vscode.Position,
	): vscode.CompletionItem[] {
		const linePrefix = document.lineAt(position).text.slice(0, position.character);
		if (/^\s*(?:#|\/\/)/.test(linePrefix)) {
			return [];
		}
		const methodRange = languageService.getMethodRange(document, position);
		if (/^\s*[A-Za-z-]*$/.test(linePrefix) && methodRange) {
			return HTTP_METHODS.map(method => {
				const item = new vscode.CompletionItem(method, vscode.CompletionItemKind.Method);
				item.insertText = method;
				item.range = methodRange;
				item.detail = `HTTP ${method} request`;
				return item;
			});
		}

		const headerRange = languageService.getHeaderNameRange(document, position);
		if (/^\s*[!#$%&'*+.^_`|~0-9A-Za-z-]*$/.test(linePrefix) && headerRange) {
			const existingHeader = document.lineAt(position.line).text.includes(':');
			return headers.map(([name, value]) => {
				const item = new vscode.CompletionItem(name, vscode.CompletionItemKind.Property);
				item.insertText = existingHeader ? name : new vscode.SnippetString(`${name}: ${value}`);
				item.range = headerRange;
				item.detail = 'HTTP request header';
				return item;
			});
		}

		const variableMatch = /\{\{\s*[\w.-]*$/.exec(linePrefix);
		if (variableMatch) {
			const suffix = document.lineAt(position.line).text.slice(position.character);
			const remaining = /^[\w.-]*(?:\s*\}\})?/.exec(suffix)?.[0] ?? '';
			return Array.from(languageService.collectVariables(document).keys(), name => {
				const item = new vscode.CompletionItem(name, vscode.CompletionItemKind.Variable);
				item.insertText = `{{${name}}}`;
				item.range = new vscode.Range(
					position.line,
					variableMatch.index,
					position.line,
					position.character + remaining.length,
				);
				item.detail = 'HTTP file variable';
				return item;
			});
		}

		if (
			languageService.getLineContext(document, position.line) === 'request' &&
			/^\s*@?[\w.-]*$/.test(linePrefix)
		) {
			const item = new vscode.CompletionItem('@variable', vscode.CompletionItemKind.Snippet);
			item.insertText = new vscode.SnippetString('@${1:name} = ${2:value}');
			item.detail = 'Define an HTTP file variable';
			return [item];
		}

		return [];
	}
}

async function sendRequest(
	resultView: ResultView,
	requestStatus: HttpRequestStatus,
	uri?: vscode.Uri,
	line?: number,
): Promise<void> {
	if (!vscode.workspace.isTrusted) {
		void vscode.window.showErrorMessage('Trust this workspace before sending HTTP requests.');
		return;
	}

	const editor = vscode.window.activeTextEditor;
	const document = uri ? await vscode.workspace.openTextDocument(uri) : editor?.document;
	if (!document || document.languageId !== 'http') {
		void vscode.window.showErrorMessage('Open an HTTP file before sending a request.');
		return;
	}

	const requestLine =
		line ??
		(editor?.document.uri.toString() === document.uri.toString()
			? editor.selection.active.line
			: 0);
	let request;
	try {
		request = languageService.parseRequest(document, requestLine);
	} catch (error) {
		void vscode.window.showErrorMessage(error instanceof Error ? error.message : String(error));
		return;
	}

	const controller = new AbortController();
	const startedAt = Date.now();
	const result: Result = {
		type: 'http', data: {
			method: request.method,
			url: request.url,
			state: 'loading',
		}
	};
	await resultView.run(result, async signal => {
		const abort = () => controller.abort();
		signal.addEventListener('abort', abort, { once: true });
		if (signal.aborted) controller.abort();
		requestStatus.start(controller, request.method);
		try {
			const response = await fetch(request.url, {
				method: request.method,
				headers: request.headers,
				body: request.body,
				signal: controller.signal,
				redirect: 'follow',
			});
			const body = await formatResponseBody(response);
			const elapsed = Date.now() - startedAt;

			Object.assign(result.data, {
				method: request.method,
				url: request.url,
				state: 'success',
				status: response.status,
				statusText: response.statusText,
				elapsed,
				headers: Array.from(response.headers.entries()),
				body,
			});
		} catch (error) {
			if (controller.signal.aborted) {
				Object.assign(result.data, {
					method: request.method,
					url: request.url,
					state: 'cancelled',
					message: 'Request cancelled.',
				});
			} else {
				const message = error instanceof Error ? error.message : String(error);
				Object.assign(result.data, {
					method: request.method,
					url: request.url,
					state: 'error',
					message: `Request failed: ${message}`,
				});
			}
		} finally {
			requestStatus.finish(controller);
			signal.removeEventListener('abort', abort);
		}
	});
}

async function formatResponseBody(response: Response): Promise<string> {
	const contentType = response.headers.get('content-type')?.toLowerCase() ?? '';
	const bytes = new Uint8Array(await response.arrayBuffer());
	const textual =
		contentType.startsWith('text/') ||
		contentType.includes('json') ||
		contentType.includes('xml') ||
		contentType.includes('javascript') ||
		contentType.includes('x-www-form-urlencoded');
	if (!textual) {
		return `[Binary response: ${bytes.byteLength} bytes, ${contentType || 'unknown content type'}]`;
	}

	const text = new TextDecoder().decode(bytes);
	if (contentType.includes('json')) {
		try {
			return JSON.stringify(JSON.parse(text), null, 2);
		} catch {
			return text;
		}
	}
	return text;
}
