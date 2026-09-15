import { basename } from 'node:path';
import * as vscode from 'vscode';
import { HttpDocumentStore } from './httpDocumentStore';
import { registerHttpFormatter } from './httpFormatter';
import {
	HTTP_METHODS,
	HttpLanguageService,
	registerHttpHoverProvider,
	registerHttpLanguageDiagnostics,
} from './httpLanguageService';
import { HttpResultPanel } from './httpResultPanel';

const headers = [
	['Accept', 'application/json'],
	['Authorization', 'Bearer ${1:token}'],
	['Content-Type', 'application/json'],
	['User-Agent', 'Toolkit HTTP Client'],
	['Cache-Control', 'no-cache'],
];
const languageService = new HttpLanguageService();
const httpSaveDelay = 500;
const httpEditorContext = 'vscode-toolkit.httpEditor';

export function registerHttpClient(context: vscode.ExtensionContext): void {
	const resultPanel = new HttpResultPanel();
	const requestStatus = new HttpRequestStatus();
	const selector: vscode.DocumentSelector = { language: 'http' };
	const documentStore = new HttpDocumentStore(context);
	const documentStoreReady = documentStore.initialize();

	context.subscriptions.push(
		vscode.window.registerWebviewViewProvider(HttpResultPanel.viewType, resultPanel, {
			webviewOptions: { retainContextWhenHidden: true },
		}),
		requestStatus,
		documentStore,
		vscode.commands.registerCommand('vscode-toolkit.openHttpClient', async () => {
			await documentStoreReady;
			await documentStore.openLastOrCreate();
		}),
		vscode.commands.registerCommand('vscode-toolkit.newHttpClient', async () => {
			await documentStoreReady;
			await documentStore.createAndOpen();
		}),
		vscode.commands.registerCommand('vscode-toolkit.renameHttpFile', () =>
			renameHttpFile(documentStore),
		),
		vscode.commands.registerCommand('vscode-toolkit.deleteHttpFile', () =>
			deleteHttpFile(documentStore),
		),
		vscode.commands.registerCommand(
			'vscode-toolkit.sendHttpRequest',
			async (uri?: vscode.Uri, line?: number) => {
				await sendRequest(resultPanel, requestStatus, uri, line);
			},
		),
		vscode.commands.registerCommand('vscode-toolkit.cancelHttpRequest', () =>
			requestStatus.cancel(),
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
		registerHttpAutoSave(documentStore),
		registerHttpEditorContext(documentStore),
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
		this.sendingItem.tooltip = '取消请求';
		this.sendingItem.command = 'vscode-toolkit.cancelHttpRequest';
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

	cancel(): void {
		for (const controller of this.controllers) {
			controller.abort();
		}
	}

	dispose(): void {
		this.cancel();
		this.sendingItem.dispose();
	}
}

async function renameHttpFile(documentStore: HttpDocumentStore): Promise<void> {
	const document = vscode.window.activeTextEditor?.document;
	if (!document || !documentStore.isManagedUri(document.uri)) {
		return;
	}

	const currentName = basename(document.uri.fsPath);
	const currentBaseName = currentName.slice(0, -'.http'.length);
	const input = await vscode.window.showInputBox({
		title: 'Rename HTTP Request',
		value: currentBaseName,
		prompt: 'File name; empty uses timestamp.',
		validateInput: value => documentStore.validateName(document.uri, value),
	});
	if (input === undefined) {
		return;
	}

	if (document.isDirty && !(await document.save())) {
		void vscode.window.showErrorMessage('Unable to save the HTTP request before renaming it.');
		return;
	}

	try {
		await documentStore.renameDocument(document.uri, input);
	} catch (error) {
		const message = error instanceof Error ? error.message : String(error);
		void vscode.window.showErrorMessage(`Unable to rename the HTTP request: ${message}`);
	}
}

async function deleteHttpFile(documentStore: HttpDocumentStore): Promise<void> {
	const document = vscode.window.activeTextEditor?.document;
	if (!document || !documentStore.isManagedUri(document.uri)) {
		return;
	}

	try {
		if (document.isDirty) {
			await document.save();
		}
		await vscode.commands.executeCommand('workbench.action.closeActiveEditor');
		await documentStore.deleteAndOpenPrevious(document.uri);
	} catch (error) {
		const message = error instanceof Error ? error.message : String(error);
		void vscode.window.showErrorMessage(`Unable to delete the HTTP request: ${message}`);
	}
}

function registerHttpEditorContext(documentStore: HttpDocumentStore): vscode.Disposable {
	const update = (editor: vscode.TextEditor | undefined): void => {
		if (editor && documentStore.isManagedUri(editor.document.uri)) {
			void documentStore.markVisited(editor.document.uri);
		}
		void vscode.commands.executeCommand(
			'setContext',
			httpEditorContext,
			Boolean(editor && documentStore.isManagedUri(editor.document.uri)),
		);
	};
	update(vscode.window.activeTextEditor);
	return vscode.window.onDidChangeActiveTextEditor(update);
}

function registerHttpAutoSave(documentStore: HttpDocumentStore): vscode.Disposable {
	const saveTimers = new Map<string, NodeJS.Timeout>();
	const clearSaveTimer = (document: vscode.TextDocument): void => {
		const key = document.uri.toString();
		const timer = saveTimers.get(key);
		if (timer) {
			clearTimeout(timer);
			saveTimers.delete(key);
		}
	};

	const changeSubscription = vscode.workspace.onDidChangeTextDocument(event => {
		const document = event.document;
		if (!documentStore.isManagedUri(document.uri) || event.contentChanges.length === 0) {
			return;
		}

		clearSaveTimer(document);
		const key = document.uri.toString();
		saveTimers.set(
			key,
			setTimeout(() => {
				saveTimers.delete(key);
				if (!document.isClosed && document.isDirty) {
					void document.save().then(saved => {
						if (!saved && !document.isClosed) {
							void vscode.window.showWarningMessage('Unable to auto-save the HTTP request.');
						}
					});
				}
			}, httpSaveDelay),
		);
	});
	const saveSubscription = vscode.workspace.onDidSaveTextDocument(clearSaveTimer);
	const closeSubscription = vscode.workspace.onDidCloseTextDocument(clearSaveTimer);

	return new vscode.Disposable(() => {
		changeSubscription.dispose();
		saveSubscription.dispose();
		closeSubscription.dispose();
		for (const timer of saveTimers.values()) {
			clearTimeout(timer);
		}
		saveTimers.clear();
	});
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
	resultPanel: HttpResultPanel,
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
	await resultPanel.show({
		method: request.method,
		url: request.url,
		state: 'loading',
	});
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

		await resultPanel.show({
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
			await resultPanel.show({
				method: request.method,
				url: request.url,
				state: 'cancelled',
				message: 'Request cancelled.',
			});
		} else {
			const message = error instanceof Error ? error.message : String(error);
			await resultPanel.show({
				method: request.method,
				url: request.url,
				state: 'error',
				message: `Request failed: ${message}`,
			});
		}
	} finally {
		requestStatus.finish(controller);
	}
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
