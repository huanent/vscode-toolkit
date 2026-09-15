import { randomUUID } from 'node:crypto';
import * as vscode from 'vscode';
import { readArchiveTree } from './archive/service';
import { readSpreadsheet } from './excel/service';
import { getDisplayName } from './shared/fileEntry';
import { openPreviewPanel } from './shared/previewPanel';
import { openSqlitePanel } from './sqlite/panel';
import { ClipboardState } from './filesystem/operations';
import { ExplorerDocument } from './document';
import { FavoritesStore } from './favoritesStore';
import { ExplorerPanelController } from './panelController';
import { isUriWithinRoot } from './uri';

const explorerViewType = 'vscode-toolkit.explorerEditor';
export const webviewFocusContextKey = 'vscode-toolkit.explorerWebviewFocus';

type PanelEntry = {
	rootUri: vscode.Uri;
	documentUri: vscode.Uri;
};

export class ExplorerManager implements vscode.Disposable {
	private clipboardState: ClipboardState | undefined;
	private readonly favoritesStore: FavoritesStore;
	private readonly panels = new Map<vscode.WebviewPanel, PanelEntry>();
	private readonly disposables: vscode.Disposable[] = [];

	constructor(private readonly context: vscode.ExtensionContext) {
		this.favoritesStore = new FavoritesStore(context);
	}

	async initialize(): Promise<void> {
		await this.favoritesStore.initialize();
	}

	register(): void {
		const editorProvider: vscode.CustomReadonlyEditorProvider<ExplorerDocument> = {
			openCustomDocument: uri => this.openCustomDocument(uri),
			resolveCustomEditor: (document, panel) => this.configurePanel(document, panel),
		};

		this.disposables.push(
			vscode.window.registerCustomEditorProvider(explorerViewType, editorProvider, {
				supportsMultipleEditorsPerDocument: true,
				webviewOptions: { retainContextWhenHidden: true },
			}),
		);
	}

	dispose(): void {
		this.disposables.forEach(disposable => disposable.dispose());
	}

	getClipboardState(): ClipboardState | undefined {
		return this.clipboardState;
	}

	async setClipboardState(state: ClipboardState): Promise<void> {
		this.clipboardState = state;
		await this.broadcastClipboardState();
	}

	async removeCompletedCutEntries(completedUris: vscode.Uri[]): Promise<void> {
		if (this.clipboardState?.operation !== 'cut' || completedUris.length === 0) {
			return;
		}
		const completed = new Set(completedUris.map(uri => uri.toString()));
		this.clipboardState.uris = this.clipboardState.uris.filter(
			uri => !completed.has(uri.toString()),
		);
		await this.broadcastClipboardState();
	}

	getFavorites(): string[] {
		return this.favoritesStore.getFavorites();
	}

	async updateFavorite(targetUri: vscode.Uri, favorite: boolean): Promise<void> {
		const favorites = this.getFavorites();
		const target = targetUri.toString();
		const updatedFavorites = favorite
			? [...new Set([...favorites, target])]
			: favorites.filter(uri => uri !== target);
		await this.favoritesStore.setFavorites(updatedFavorites);
		await this.broadcastFavorites(updatedFavorites);
	}

	revealExplorer(): boolean {
		const panel = [...this.panels.keys()].at(-1);
		if (!panel) {
			return false;
		}
		panel.reveal(panel.viewColumn, false);
		return true;
	}

	async openExplorer(
		rootUri: vscode.Uri,
		viewColumn: vscode.ViewColumn = vscode.ViewColumn.Active,
		initialViewState?: ExplorerDocument['latestViewState'],
	): Promise<void> {
		const folderName = getDisplayName(rootUri);
		const resourceName = folderName === '/' ? 'root' : folderName;
		const query = new URLSearchParams({ root: rootUri.toString(), id: randomUUID() });
		if (initialViewState) {
			query.set('current', initialViewState.currentUri);
			query.set('history', JSON.stringify(initialViewState.history));
		}
		const resourceUri = vscode.Uri.from({
			scheme: 'vscode-toolkit-explorer',
			path: `/${resourceName}`,
			query: query.toString(),
		});
		await vscode.commands.executeCommand('vscode.openWith', resourceUri, explorerViewType, {
			preview: false,
			viewColumn,
		});
	}

	async openSpreadsheetPreview(uri: vscode.Uri): Promise<void> {
		const name = getDisplayName(uri);
		await openPreviewPanel(this.context, {
			viewType: 'vscode-toolkit.explorerSpreadsheetPreview',
			title: name,
			icon: 'table',
			entryPoint: 'spreadsheet',
			load: () => readSpreadsheet(uri),
		});
	}

	async openArchivePreview(uri: vscode.Uri): Promise<void> {
		const name = getDisplayName(uri);
		await openPreviewPanel(this.context, {
			viewType: 'vscode-toolkit.explorerArchivePreview',
			title: name,
			icon: 'file-zip',
			entryPoint: 'archive',
			load: () => readArchiveTree(uri),
		});
	}

	async openSqliteManager(uri: vscode.Uri): Promise<void> {
		openSqlitePanel(this.context, uri);
	}

	private openCustomDocument(uri: vscode.Uri): ExplorerDocument {
		const rootValue = new URLSearchParams(uri.query).get('root');
		if (!rootValue) {
			throw new Error('The explorer resource does not contain a root folder.');
		}
		const document = new ExplorerDocument(uri, vscode.Uri.parse(rootValue));
		const currentValue = new URLSearchParams(uri.query).get('current');
		if (currentValue) {
			document.latestViewState = {
				currentUri: currentValue,
				history: parseHistory(uri),
			};
		}
		return document;
	}

	private configurePanel(document: ExplorerDocument, panel: vscode.WebviewPanel): void {
		const isSplitCopy = [...this.panels.values()].some(
			entry => entry.documentUri.toString() === document.uri.toString(),
		);
		if (isSplitCopy) {
			void this.replaceSplitCopy(document, panel);
			return;
		}

		this.panels.set(panel, { rootUri: document.rootUri, documentUri: document.uri });
		const controller = new ExplorerPanelController(this.context, this, panel, document);
		panel.onDidDispose(() => {
			this.panels.delete(panel);
			controller.dispose();
		});
	}

	private async replaceSplitCopy(
		document: ExplorerDocument,
		panel: vscode.WebviewPanel,
	): Promise<void> {
		try {
			await this.openExplorer(
				document.rootUri,
				panel.viewColumn ?? vscode.ViewColumn.Active,
				document.latestViewState,
			);
		} finally {
			panel.dispose();
		}
	}

	private async broadcastClipboardState(): Promise<void> {
		if (!this.clipboardState) {
			return;
		}
		await Promise.all([...this.panels.keys()].map(panel => this.sendClipboardState(panel.webview)));
	}

	async sendClipboardState(webview: vscode.Webview): Promise<void> {
		if (!this.clipboardState) {
			return;
		}
		await webview.postMessage({
			type: 'clipboardChanged',
			hasEntry: this.clipboardState.uris.length > 0,
			operation: this.clipboardState.operation,
			uris: this.clipboardState.uris.map(uri => uri.toString()),
		});
	}

	async sendFavorites(webview: vscode.Webview, rootUri: vscode.Uri): Promise<void> {
		await webview.postMessage({
			type: 'favoritesChanged',
			favorites: this.getFavoritesWithinRoot(rootUri, this.getFavorites()),
		});
	}

	private async broadcastFavorites(favorites: string[]): Promise<void> {
		await Promise.all(
			[...this.panels].map(([panel, { rootUri }]) =>
				panel.webview.postMessage({
					type: 'favoritesChanged',
					favorites: this.getFavoritesWithinRoot(rootUri, favorites),
				}),
			),
		);
	}

	private getFavoritesWithinRoot(rootUri: vscode.Uri, favorites: string[]) {
		return favorites.filter(value => isUriWithinRoot(rootUri, value));
	}
}

function parseHistory(uri: vscode.Uri): string[] {
	const historyValue = new URLSearchParams(uri.query).get('history');
	if (!historyValue) {
		return [];
	}
	try {
		const history = JSON.parse(historyValue);
		return Array.isArray(history) && history.every(item => typeof item === 'string') ? history : [];
	} catch {
		return [];
	}
}
