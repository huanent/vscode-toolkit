import { randomUUID } from 'node:crypto';
import * as vscode from 'vscode';
import type { StoredSession } from './session';
import { commandIds, editorViewType, storageKeys } from './constants';
import { ChatDocument } from './document';
import { ModelService } from './modelService';
import { ChatPanelController } from './panelController';
import { SessionStorage } from './storage';

export class ChatManager implements vscode.Disposable {
	private readonly sessions: StoredSession[];
	private readonly controllers = new Set<ChatPanelController>();
	private readonly modelService: ModelService;
	private readonly disposables: vscode.Disposable[] = [];
	private currentController: ChatPanelController | undefined;
	private sessionsLoaded: Promise<void> = Promise.resolve();

	private constructor(
		private readonly context: vscode.ExtensionContext,
		private readonly sessionStorage: SessionStorage,
		sessions: StoredSession[],
	) {
		this.sessions = sessions;
		this.modelService = new ModelService(context);
	}

	static async create(context: vscode.ExtensionContext): Promise<ChatManager> {
		const sessionStorage = await SessionStorage.create(context);
		const manager = new ChatManager(context, sessionStorage, []);
		manager.sessionsLoaded = manager.loadSessions();
		return manager;
	}

	register(): void {
		this.modelService.register(this.disposables);
		const provider: vscode.CustomReadonlyEditorProvider<ChatDocument> = {
			openCustomDocument: uri => new ChatDocument(uri, this.sessions),
			resolveCustomEditor: (document, panel) => this.configurePanel(document, panel),
		};
		this.disposables.push(
			vscode.commands.registerCommand(commandIds.open, () => this.open(true)),
			vscode.commands.registerCommand(commandIds.newChat, () => this.open(true)),
			vscode.commands.registerCommand(commandIds.newTab, () => this.open(false)),
			vscode.window.registerCustomEditorProvider(editorViewType, provider, {
				webviewOptions: { retainContextWhenHidden: true },
				supportsMultipleEditorsPerDocument: true,
			}),
		);
	}

	dispose(): void {
		this.controllers.forEach(controller => controller.dispose());
		this.modelService.dispose();
		this.disposables.forEach(disposable => disposable.dispose());
	}

	getEditors(): readonly ChatPanelController[] {
		return [...this.controllers];
	}

	setCurrent(controller: ChatPanelController): void {
		this.currentController = controller;
	}

	remove(controller: ChatPanelController): void {
		this.controllers.delete(controller);
		if (this.currentController === controller) {
			this.currentController = this.controllers.values().next().value;
		}
	}

	async persist(currentSessionId: string): Promise<void> {
		await this.sessionsLoaded;
		await Promise.all([
			this.sessionStorage.persist(this.sessions),
			this.context.globalState.update(storageKeys.currentSession, currentSessionId),
		]);
	}

	private async loadSessions(): Promise<void> {
		const loadedSessions = await this.sessionStorage.load();
		const currentSessionIds = new Set(this.sessions.map(session => session.id));
		this.sessions.push(...loadedSessions.filter(session => !currentSessionIds.has(session.id)));
		await Promise.all(this.getEditors().map(editor => editor.refreshSessions()));
	}

	private async open(reuseCurrent: boolean): Promise<void> {
		if (reuseCurrent && this.currentController) {
			this.currentController.reveal();
			await this.currentController.newChat();
			return;
		}
		await vscode.commands.executeCommand('vscode.openWith', createEditorUri(), editorViewType, {
			viewColumn: vscode.ViewColumn.Active,
		});
	}

	private configurePanel(document: ChatDocument, panel: vscode.WebviewPanel): void {
		if ([...this.controllers].some(controller => controller.document === document)) {
			void this.replaceSplitEditor(panel);
			return;
		}
		const controller = new ChatPanelController(
			this.context,
			this,
			this.modelService,
			panel,
			document,
		);
		this.controllers.add(controller);
		this.currentController = controller;
	}

	private async replaceSplitEditor(panel: vscode.WebviewPanel): Promise<void> {
		const viewColumn = panel.viewColumn ?? vscode.ViewColumn.Active;
		panel.dispose();
		await vscode.commands.executeCommand('vscode.openWith', createEditorUri(), editorViewType, {
			viewColumn,
		});
	}
}

function createEditorUri(): vscode.Uri {
	return vscode.Uri.from({
		scheme: 'vscode-toolkit-chat',
		path: '/Chat',
		query: new URLSearchParams({ id: randomUUID() }).toString(),
	});
}
