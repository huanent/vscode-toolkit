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

test('Dashboard is a singleton with isolated channels, favorites and reopen support', async () => {
	const commands = new Map();
	const panels = [];
	const saved = new Map();
	const vscode = {
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
				return commands.get(name)?.(request);
			},
		},
		window: {
			createWebviewPanel() {
				const listeners = new Set();
				const disposeListeners = [];
				const messages = [];
				const panel = {
					messages,
					reveals: 0,
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
	assert.equal(panels.length, 1);
	assert.equal(dashboard.dashboardFeaturePanel('ssh', true), ssh);
	ssh.webview.html = 'old-html';
	assert.equal(panels[0].webview.html, 'dashboard-html');
	const received = [];
	ssh.webview.onDidReceiveMessage(message => received.push(message));
	await panels[0].receive({ channel: 'database', type: 'delete', id: 'same-id' });
	assert.equal(received.length, 0);
	await panels[0].receive({ channel: 'ssh', type: 'connect', id: 'same-id' });
	assert.equal(received.length, 1);
	await database.webview.postMessage({ type: 'state', servers: [] });
	assert.equal(panels[0].messages.at(-1).channel, 'database');
	database.reveal();
	assert.deepEqual(panels[0].messages.at(-1), { type: 'dashboardTab', tab: 'database' });
	await panels[0].receive({
		type: 'dashboardFavorites',
		favorites: [
			{ tab: 'ssh', id: 'same-id', password: 'must-not-persist' },
			{ tab: 'database', id: 'same-id' },
		],
	});
	assert.deepEqual(saved.get('toolkit.dashboard.favorites'), [
		{ tab: 'ssh', id: 'same-id' },
		{ tab: 'database', id: 'same-id' },
	]);
	panels[0].dispose();
	await vscode.commands.executeCommand('vscode-toolkit.openDashboard');
	assert.equal(panels.length, 2);
	assert.notEqual(dashboard.dashboardFeaturePanel('ssh', true), ssh);
	await panels[1].receive({ type: 'dashboardReady' });
	assert.equal(panels[1].messages[0].favorites.length, 2);
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
	assert.equal(manifest.contributes.viewsContainers.activitybar, undefined);
	assert.equal(manifest.contributes.views['vscode-toolkit'], undefined);
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
