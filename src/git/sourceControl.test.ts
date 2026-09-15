import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import * as vscode from 'vscode';
import { registerSourceControl } from './sourceControl';

const mocks = vi.hoisted(() => ({ execute: vi.fn() }));

vi.mock('node:util', () => ({ promisify: () => mocks.execute }));
vi.mock('vscode', () => ({
	EventEmitter: class {
		event = vi.fn();
		fire = vi.fn();
		dispose = vi.fn();
	},
	Uri: {
		joinPath: (uri: vscode.Uri, segment: string) => {
			const path = segment === '..' ? uri.path.slice(0, uri.path.lastIndexOf('/')) : `${uri.path}/${segment}`;
			return { scheme: uri.scheme, path, fsPath: path };
		},
	},
	commands: { registerCommand: vi.fn(), executeCommand: vi.fn() },
	window: {
		registerFileDecorationProvider: vi.fn(),
		showQuickPick: vi.fn(),
		showErrorMessage: vi.fn(),
		showInformationMessage: vi.fn(),
		createTerminal: vi.fn(),
	},
	workspace: {
		findFiles: vi.fn(),
		createFileSystemWatcher: vi.fn(),
		onDidChangeWorkspaceFolders: vi.fn(),
	},
}));

describe('Git source control', () => {
	let context: vscode.ExtensionContext;
	let changed: () => void;
	const folder = { scheme: 'file', path: '/repo', fsPath: '/repo' } as vscode.Uri;

	beforeEach(() => {
		vi.useFakeTimers();
		mocks.execute.mockReset().mockResolvedValue({ stdout: 'main\n' });
		vi.mocked(vscode.workspace.findFiles).mockReset().mockResolvedValue([]);
		const disposable = { dispose: vi.fn() };
		vi.mocked(vscode.commands.registerCommand).mockReturnValue(disposable);
		vi.mocked(vscode.window.registerFileDecorationProvider).mockReturnValue(disposable);
		vi.mocked(vscode.workspace.onDidChangeWorkspaceFolders).mockReturnValue(disposable);
		vi.mocked(vscode.workspace.createFileSystemWatcher).mockImplementation(() => ({
			...disposable,
			onDidCreate: vi.fn(),
			onDidDelete: vi.fn(),
			onDidChange: vi.fn(callback => { changed = callback; return disposable; }),
		}) as unknown as vscode.FileSystemWatcher);
		context = { subscriptions: [] } as unknown as vscode.ExtensionContext;
	});

	afterEach(() => {
		context.subscriptions.forEach(subscription => subscription.dispose());
		vi.useRealTimers();
	});

	async function register() {
		registerSourceControl(context);
		await vi.advanceTimersByTimeAsync(0);
		return vi.mocked(vscode.commands.registerCommand).mock.calls.find(
			([command]) => command === 'vscode-toolkit.checkoutGitRepository',
		)![1];
	}

	it('coalesces file events and cancels pending refresh on disposal', async () => {
		await register();
		changed();
		changed();
		changed();
		await vi.advanceTimersByTimeAsync(200);
		expect(vscode.workspace.findFiles).toHaveBeenCalledTimes(4);
		changed();
		context.subscriptions.forEach(subscription => subscription.dispose());
		await vi.advanceTimersByTimeAsync(200);
		expect(vscode.workspace.findFiles).toHaveBeenCalledTimes(4);
	});

	it('deduplicates repository markers', async () => {
		vi.mocked(vscode.workspace.findFiles).mockResolvedValue([
			{ ...folder, path: '/repo/.git/HEAD' } as vscode.Uri,
			{ ...folder, path: '/repo/.git' } as vscode.Uri,
		]);
		await register();
		expect(mocks.execute).toHaveBeenCalledTimes(1);
		expect(vscode.commands.executeCommand).toHaveBeenCalledWith(
			'setContext', 'vscode-toolkit.gitRepositoryFolders', { '/repo': true },
		);
	});

	it('discards a refresh invalidated by a newer event', async () => {
		let resolveSearch!: (uris: vscode.Uri[]) => void;
		vi.mocked(vscode.workspace.findFiles).mockReturnValueOnce(new Promise(resolve => { resolveSearch = resolve; }));
		registerSourceControl(context);
		changed();
		resolveSearch([]);
		await vi.advanceTimersByTimeAsync(0);
		expect(vscode.commands.executeCommand).not.toHaveBeenCalled();
		await vi.advanceTimersByTimeAsync(200);
		expect(vscode.commands.executeCommand).toHaveBeenCalledTimes(1);
	});

	it('passes branch names as arguments and retains real HEAD branches', async () => {
		const checkout = await register();
		mocks.execute.mockResolvedValueOnce({ stdout: 'refs/heads/topic/HEAD\ttopic/HEAD\t \t\nrefs/heads/$(example)\t$(example)\t \t\nrefs/remotes/origin/HEAD\torigin/HEAD\t \trefs/remotes/origin/main\n' });
		vi.mocked(vscode.window.showQuickPick).mockImplementationOnce(async items => (items as vscode.QuickPickItem[])[1]);
		await checkout(folder);
		expect(vscode.window.showQuickPick).toHaveBeenCalledWith(
			expect.arrayContaining([expect.objectContaining({ label: 'topic/HEAD' })]), expect.anything(),
		);
		expect(vi.mocked(vscode.window.showQuickPick).mock.calls[0][0]).toHaveLength(2);
		expect(mocks.execute).toHaveBeenLastCalledWith('git', ['switch', '--', '$(example)'], expect.objectContaining({ cwd: '/repo', timeout: 15_000 }));
		expect(vscode.window.createTerminal).not.toHaveBeenCalled();
	});

	it('tracks remote branches using their full reference', async () => {
		const checkout = await register();
		mocks.execute.mockResolvedValueOnce({ stdout: 'refs/remotes/origin/topic\torigin/topic\t \t\n' });
		vi.mocked(vscode.window.showQuickPick).mockImplementationOnce(async items => (items as vscode.QuickPickItem[])[0]);
		await checkout(folder);
		expect(mocks.execute).toHaveBeenLastCalledWith('git', ['switch', '--track', '--', 'refs/remotes/origin/topic'], expect.anything());
	});

	it('reports switch failures without opening a terminal', async () => {
		const checkout = await register();
		mocks.execute.mockResolvedValueOnce({ stdout: 'refs/heads/topic\ttopic\t \t\n' }).mockRejectedValueOnce(new Error('Local changes would be overwritten'));
		vi.mocked(vscode.window.showQuickPick).mockImplementationOnce(async items => (items as vscode.QuickPickItem[])[0]);
		await checkout(folder);
		expect(vscode.window.showErrorMessage).toHaveBeenCalledWith(expect.stringContaining('Local changes would be overwritten'));
	});
});