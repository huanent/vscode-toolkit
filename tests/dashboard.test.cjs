const assert = require('node:assert/strict');
const fs = require('node:fs');
const { test } = require('node:test');
const ts = require('typescript');

function load(file, dependencies = {}) {
	const compiled = ts.transpileModule(fs.readFileSync(file, 'utf8'), {
		compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
	}).outputText;
	const loaded = { exports: {} };
	new Function('require', 'module', 'exports', compiled)(
		name => dependencies[name] ?? require(name),
		loaded,
		loaded.exports,
	);
	return loaded.exports;
}

test('Workflow storage uses JSON files and serializes mutations without losing data', async () => {
	const files = new Map();
	let failWrites = false;
	class FileSystemError extends Error {
		code = 'FileNotFound';
	}
	const { WorkflowStore } = load('src/features/workflow/store.ts', {
		vscode: {
			FileSystemError,
			Uri: { joinPath: (...parts) => parts.join('/') },
			workspace: { fs: {
				async createDirectory() {},
				async readFile(uri) {
					if (!files.has(uri)) throw new FileSystemError();
					return files.get(uri);
				},
				async writeFile(uri, content) {
					if (failWrites) throw new Error('Write failed');
					files.set(uri, content);
				},
			} },
		},
		'../../storagePath': { getStorageUri: (_context, directory) => `/configured/${directory}` },
		'./workflow': load('src/features/workflow/workflow.ts'),
	});
	const context = {};
	const store = new WorkflowStore(context);
	assert.deepEqual(await store.list(), []);
	failWrites = true;
	await assert.rejects(store.save({ id: 'failed', name: 'Failed', steps: [] }), /Write failed/);
	assert.equal(files.size, 0);
	failWrites = false;
	await Promise.all([
		store.save({ id: 'first', name: 'First', steps: [] }),
		store.save({ id: 'second', name: 'Second', steps: [] }),
	]);
	assert.ok(files.has('/configured/workflow/workflows.json'));
	await store.save({ id: 'second', name: 'Updated', steps: [] });
	await store.delete('first');
	assert.deepEqual(await new WorkflowStore(context).list(), [
		{ id: 'second', name: 'Updated', description: '', steps: [] },
	]);
	files.set('/configured/workflow/workflows.json', Buffer.from('{invalid'));
	await assert.rejects(store.list(), SyntaxError);
	await assert.rejects(store.save({ id: 'new', name: 'New', steps: [] }), SyntaxError);
	assert.equal(files.get('/configured/workflow/workflows.json').toString(), '{invalid');
});

test('Dashboard sidebar routes editing to tabs and isolates credentials', async () => {
	const commands = new Map();
	const panels = [];
	const saved = new Map();
	let provider;
	let view;
	const vscode = {
		EventEmitter: class {
			listeners = new Set();
			event = listener => {
				this.listeners.add(listener);
				return { dispose: () => this.listeners.delete(listener) };
			};
			fire(value) {
				for (const listener of this.listeners) listener(value);
			}
			dispose() {
				this.listeners.clear();
			}
		},
		ThemeIcon: class {
			constructor(id) {
				this.id = id;
			}
		},
		Uri: { joinPath: (...parts) => parts.join('/') },
		ViewColumn: { Active: 1 },
		commands: {
			registerCommand(name, handler) {
				commands.set(name, handler);
				return { dispose() {} };
			},
			async executeCommand(name, request) {
				if (name === 'vscode-toolkit.dashboard.focus' && !view) {
					view = vscode.window.createWebviewPanel();
					panels.pop();
					await provider.resolveWebviewView(view);
				}
				return commands.get(name)?.(request);
			},
		},
		window: {
			registerWebviewViewProvider(_id, value) {
				provider = value;
				return { dispose() {} };
			},
			createWebviewPanel() {
				const listeners = new Set();
				const disposeListeners = [];
				const messages = [];
				const panel = {
					messages,
					reveals: 0,
					show() {
						this.reveals++;
					},
					webview: {
						html: '',
						postMessage: async message => {
							messages.push(message);
							return true;
						},
						onDidReceiveMessage(listener) {
							listeners.add(listener);
							return { dispose: () => listeners.delete(listener) };
						},
					},
					onDidDispose(listener) {
						disposeListeners.push(listener);
						return { dispose() {} };
					},
					reveal() {
						this.reveals++;
					},
					dispose() {
						disposeListeners.forEach(listener => listener());
					},
					async receive(message) {
						await Promise.all([...listeners].map(listener => listener(message)));
					},
				};
				panels.push(panel);
				return panel;
			},
		},
	};
	const dashboard = load('src/features/dashboard/panel.ts', {
		vscode,
		'../../webview': { getWebviewHtml: () => 'dashboard-html' },
	});
	dashboard.registerDashboard({
		extensionUri: 'extension',
		subscriptions: [],
		globalState: {
			get: (key, fallback) => saved.get(key) ?? fallback,
			update: async (key, value) => {
				saved.set(key, value);
			},
		},
	});
	await vscode.commands.executeCommand('vscode-toolkit.openDashboard');
	const ssh = dashboard.dashboardFeaturePanel('ssh', true);
	const database = dashboard.dashboardFeaturePanel('database', true);
	assert.equal(panels.length, 0);
	assert.equal(dashboard.dashboardFeaturePanel('ssh', true), ssh);
	assert.equal(view.webview.html, 'dashboard-html');
	const received = [];
	ssh.webview.onDidReceiveMessage(message => received.push(message));
	await view.receive({ channel: 'database', type: 'delete', id: 'same-id' });
	assert.equal(received.length, 0);
	await view.receive({ channel: 'ssh', type: 'connect', id: 'same-id' });
	assert.equal(received.length, 1);
	await database.webview.postMessage({ type: 'state', servers: [] });
	assert.equal(view.messages.at(-1).channel, 'database');
	await view.receive({ channel: 'ssh', type: 'edit', id: 'same-id' });
	assert.equal(panels.length, 1);
	assert.equal(received.length, 1);
	await panels[0].receive({ type: 'editorReady' });
	assert.equal(panels[0].messages.at(-1).request.id, 'same-id');
	await panels[0].receive({ channel: 'ssh', type: 'edit', id: 'same-id' });
	assert.equal(received.length, 2);
	await ssh.webview.postMessage({ type: 'initialize', credentials: { password: 'private' } });
	assert.equal(panels[0].messages.at(-1).type, 'initialize');
	assert.equal(
		view.messages.some(message => message.type === 'initialize'),
		false,
	);
	await ssh.webview.postMessage({ type: 'state', servers: [] });
	assert.equal(view.messages.at(-1).type, 'state');
	await view.receive({
		type: 'dashboardFavorites',
		favorites: [
			{ tab: 'ssh', id: 'same-id', password: 'must-not-persist' },
			{ tab: 'database', id: 'same-id' },
		],
	});
	assert.equal(saved.has('toolkit.dashboard.favorites'), false);
	view.dispose();
	view = undefined;
	await vscode.commands.executeCommand('vscode-toolkit.openDashboard');
	assert.equal(panels.length, 1);
	assert.equal(dashboard.dashboardFeaturePanel('ssh', true), ssh);
	await view.receive({ type: 'dashboardReady' });
	assert.equal(
		Object.hasOwn(view.messages.find(message => message.type === 'dashboardState'), 'favorites'),
		false,
	);
});

test('form sessions reject stale messages and preserve a save in progress', async () => {
	const { createFormSession } = load('src/features/dashboard/formSession.ts');
	const messages = [];
	let handled = 0;
	let finish;
	const form = createFormSession(
		{ webview: { postMessage: async message => messages.push(message) } },
		async server => ({ id: server.id }),
		{},
		async (_message, _server, _credentials, _duplicate, state, saved) => {
			handled++;
			state.inProgress = true;
			await new Promise(resolve => {
				finish = resolve;
			});
			saved();
		},
	);
	await form.open({ id: 'first' });
	await form.open({ id: 'second' });
	await form.receive({ type: 'formMessage', sessionId: 1, message: { type: 'save' } });
	assert.equal(handled, 0);
	const pending = form.receive({ type: 'formMessage', sessionId: 2, message: { type: 'save' } });
	await form.receive({ type: 'closeForm' });
	await form.open({ id: 'third' });
	assert.equal(messages.length, 2);
	finish();
	await pending;
	assert.deepEqual(messages.at(-1), { type: 'saved', sessionId: 2 });
	form.dispose();
	await form.receive({ type: 'formMessage', sessionId: 2, message: { type: 'save' } });
	assert.equal(handled, 1);
});

test('Dashboard owns navigation and management build entry', () => {
	const manifest = JSON.parse(fs.readFileSync('package.json', 'utf8'));
	assert.equal(manifest.contributes.viewsContainers.activitybar[0].id, 'vscode-toolkit');
	assert.equal(manifest.contributes.views['vscode-toolkit'][0].type, 'webview');
	assert.equal(
		manifest.contributes.keybindings.find(binding => binding.key === 'ctrl+shift+.').command,
		'vscode-toolkit.openDashboard',
	);
	const config = fs.readFileSync('vite.config.mts', 'utf8');
	assert.match(config, /dashboard: 'webview\/src\/features\/dashboard\/main.tsx'/);
	assert.doesNotMatch(
		config,
		/(?:sshManagement|databaseManagement|containerManagement|launchd|workflow):/,
	);
});
