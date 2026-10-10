import { beforeEach, describe, expect, it, vi } from 'vitest';
import * as vscode from 'vscode';
import type { DebugProtocol as dap } from '@vscode/debugprotocol';
import { performance } from 'node:perf_hooks';
import { createPerfTipsTracker, PerfTipsProvider } from './perftips';

vi.mock('node:perf_hooks', () => ({ performance: { now: vi.fn() } }));
vi.mock('vscode', () => ({
	workspace: { getConfiguration: vi.fn() },
	window: {
		createTextEditorDecorationType: vi.fn(),
		onDidChangeVisibleTextEditors: vi.fn(),
		visibleTextEditors: [],
	},
	debug: { asDebugSourceUri: vi.fn() },
	ThemeColor: class {
		constructor(public id: string) {}
	},
	DecorationRangeBehavior: { ClosedOpen: 1 },
	Range: class {
		constructor(
			public start: unknown,
			public end: unknown,
		) {}
	},
}));

describe('PerfTips setting', () => {
	it.each([true, false, undefined])('respects enabled=%s with an enabled default', enabled => {
		const get = vi.fn((_key: string, fallback: boolean) => enabled ?? fallback);
		vi.mocked(vscode.workspace.getConfiguration).mockReturnValue({
			get,
		} as unknown as vscode.WorkspaceConfiguration);
		const tracker = createPerfTipsTracker({ id: 'session' } as vscode.DebugSession);
		expect(vscode.workspace.getConfiguration).toHaveBeenCalledWith('toolkit.perftips');
		expect(get).toHaveBeenCalledWith('enabled', true);
		if (enabled === false) {
			expect(tracker).toBeUndefined();
		} else {
			expect(tracker).toBeInstanceOf(PerfTipsProvider);
		}
	});
});

describe('PerfTipsProvider', () => {
	let provider: PerfTipsProvider;
	let editor: vscode.TextEditor;
	let visibleChanged: () => void;
	const session = { id: 'first' } as vscode.DebugSession;
	const decoration = { dispose: vi.fn() } as unknown as vscode.TextEditorDecorationType;
	const listener = { dispose: vi.fn() };

	function request(command: string, seq = 1, args = {}) {
		provider.onWillReceiveMessage({
			type: 'request',
			seq,
			command,
			arguments: args,
		} as dap.Request);
	}
	function event(name: string, body = {}) {
		provider.onDidSendMessage({ type: 'event', seq: 1, event: name, body } as dap.Event);
	}
	function stop(threadId = 0) {
		request('next');
		vi.mocked(performance.now).mockReturnValue(125);
		event('stopped', { threadId });
		request('stackTrace', 2, { threadId });
	}
	function respond(line = 1, requestSeq = 2) {
		provider.onDidSendMessage({
			type: 'response',
			seq: 3,
			request_seq: requestSeq,
			success: true,
			command: 'stackTrace',
			body: {
				stackFrames: [{ id: 1, name: 'main', line, column: 1, source: { path: '/test.ts' } }],
			},
		} as dap.StackTraceResponse);
	}

	beforeEach(() => {
		vi.mocked(performance.now).mockReturnValue(100);
		vi.mocked(vscode.window.createTextEditorDecorationType).mockReturnValue(decoration);
		vi.mocked(vscode.window.onDidChangeVisibleTextEditors).mockImplementation(callback => {
			visibleChanged = () => callback([]);
			return listener;
		});
		vi.mocked(vscode.debug.asDebugSourceUri).mockReturnValue({
			toString: () => '/test.ts',
		} as vscode.Uri);
		editor = {
			document: {
				uri: { toString: () => '/test.ts' },
				lineCount: 3,
				lineAt: vi.fn(() => ({ range: { end: { line: 0, character: 10 } } })),
			},
			setDecorations: vi.fn(),
		} as unknown as vscode.TextEditor;
		vscode.window.visibleTextEditors = [editor];
		provider = new PerfTipsProvider(session);
		provider.onWillStartSession();
	});

	it('uses the owning session and accepts thread zero', () => {
		stop();
		respond();
		expect(vscode.debug.asDebugSourceUri).toHaveBeenCalledWith({ path: '/test.ts' }, session);
		expect(editor.setDecorations).toHaveBeenLastCalledWith(decoration, [
			expect.objectContaining({
				renderOptions: { after: { contentText: '25.0 ms debug interval' } },
			}),
		]);
	});

	it('does not count initial startup as execution', () => {
		event('stopped', { threadId: 0 });
		request('stackTrace', 2, { threadId: 0 });
		respond();
		expect(editor.setDecorations).not.toHaveBeenCalled();
	});

	it.each(['continue', 'stepBack', 'reverseContinue', 'restartFrame', 'goto', 'restart'])(
		'%s clears annotations and invalidates old responses',
		command => {
			stop();
			respond();
			request('stackTrace', 4, { threadId: 0 });
			request(command, 5);
			respond(1, 4);
			visibleChanged();
			expect(editor.setDecorations).toHaveBeenLastCalledWith(decoration, []);
		},
	);

	it('waits for a visible editor without opening source', () => {
		vscode.window.visibleTextEditors = [];
		stop();
		respond();
		expect(editor.setDecorations).not.toHaveBeenCalled();
		vscode.window.visibleTextEditors = [editor];
		visibleChanged();
		expect(editor.setDecorations).toHaveBeenCalledOnce();
	});

	it('does not render a pending target after execution resumes', () => {
		vscode.window.visibleTextEditors = [];
		stop();
		respond();
		request('continue', 4);
		vscode.window.visibleTextEditors = [editor];
		visibleChanged();
		expect(editor.setDecorations).not.toHaveBeenCalled();
	});

	it('clears the previous file when stepping into another file', () => {
		stop();
		respond();
		request('next', 4);
		const nextEditor = {
			document: { ...editor.document, uri: { toString: () => '/next.ts' } },
			setDecorations: vi.fn(),
		} as unknown as vscode.TextEditor;
		vi.mocked(vscode.debug.asDebugSourceUri).mockReturnValueOnce({
			toString: () => '/next.ts',
		} as vscode.Uri);
		vscode.window.visibleTextEditors = [editor, nextEditor];
		event('stopped', { threadId: 0 });
		request('stackTrace', 5, { threadId: 0 });
		respond(1, 5);
		expect(editor.setDecorations).toHaveBeenLastCalledWith(decoration, []);
		expect(nextEditor.setDecorations).toHaveBeenCalledOnce();
	});

	it('ignores superseded responses and consumes the matching response once', () => {
		stop();
		request('stackTrace', 4, { threadId: 0 });
		respond();
		expect(editor.setDecorations).not.toHaveBeenCalled();
		respond(1, 4);
		respond(1, 4);
		expect(editor.setDecorations).toHaveBeenCalledOnce();
	});

	it.each([{ threadId: 1 }, { threadId: 0, startFrame: 1 }])(
		'ignores unrelated stack requests %j',
		args => {
			stop();
			request('stackTrace', 4, args);
			respond(1, 4);
			expect(editor.setDecorations).not.toHaveBeenCalled();
			respond();
			expect(editor.setDecorations).toHaveBeenCalledOnce();
		},
	);

	it('drops a pending annotation when the session terminates', () => {
		vscode.window.visibleTextEditors = [];
		stop();
		respond();
		event('terminated');
		vscode.window.visibleTextEditors = [editor];
		visibleChanged();
		expect(editor.setDecorations).not.toHaveBeenCalled();
		expect(decoration.dispose).toHaveBeenCalledOnce();
	});

	it.each([undefined, { stackFrames: [] }, { stackFrames: [{ line: 1 }] }])(
		'ignores missing stack frames or sources %j',
		body => {
			stop();
			provider.onDidSendMessage({
				type: 'response',
				seq: 3,
				request_seq: 2,
				command: 'stackTrace',
				success: true,
				body,
			} as dap.Response);
			expect(editor.setDecorations).not.toHaveBeenCalled();
		},
	);

	it('starts timing an adapter-initiated continuation', () => {
		event('continued');
		vi.mocked(performance.now).mockReturnValue(125);
		event('stopped', { threadId: 0 });
		request('stackTrace', 2, { threadId: 0 });
		respond();
		expect(editor.setDecorations).toHaveBeenLastCalledWith(decoration, [
			expect.objectContaining({
				renderOptions: { after: { contentText: '25.0 ms debug interval' } },
			}),
		]);
	});

	it.each([0, -1, 4, NaN, 1.5])('ignores invalid frame line %s', line => {
		stop();
		respond(line);
		expect(editor.setDecorations).not.toHaveBeenCalled();
	});

	it('supports zero-based lines negotiated during initialization', () => {
		request('initialize', 1, { linesStartAt1: false });
		stop();
		respond(0);
		expect(editor.document.lineAt).toHaveBeenCalledWith(0);
	});

	it('handles unavailable debug sources', () => {
		vi.mocked(vscode.debug.asDebugSourceUri).mockImplementationOnce(() => {
			throw new Error('Unavailable');
		});
		stop();
		expect(() => respond()).not.toThrow();
		expect(editor.setDecorations).not.toHaveBeenCalled();
	});

	it('invalidates previous requests on focus-preserving stops', () => {
		stop();
		event('stopped', { threadId: 1, preserveFocusHint: true });
		respond();
		expect(editor.setDecorations).not.toHaveBeenCalled();
	});

	it('does not restart the request timer on continued events', () => {
		request('continue');
		vi.mocked(performance.now).mockReturnValue(110);
		event('continued');
		vi.mocked(performance.now).mockReturnValue(125);
		event('stopped', { threadId: 0 });
		request('stackTrace', 2, { threadId: 0 });
		respond();
		expect(editor.setDecorations).toHaveBeenLastCalledWith(decoration, [
			expect.objectContaining({
				renderOptions: { after: { contentText: '25.0 ms debug interval' } },
			}),
		]);
	});

	it('drops timing after a failed resume request', () => {
		request('next');
		provider.onDidSendMessage({
			type: 'response',
			seq: 3,
			request_seq: 1,
			command: 'next',
			success: false,
		} as dap.Response);
		event('stopped', { threadId: 0 });
		request('stackTrace', 2, { threadId: 0 });
		respond();
		expect(editor.setDecorations).not.toHaveBeenCalled();
	});

	it.each(['onWillStopSession', 'onExit', 'onError'] as const)(
		'%s disposes once and ignores late responses',
		method => {
			stop();
			provider[method]();
			provider[method]();
			respond();
			visibleChanged();
			expect(decoration.dispose).toHaveBeenCalledOnce();
			expect(listener.dispose).toHaveBeenCalledOnce();
			expect(editor.setDecorations).not.toHaveBeenCalled();
		},
	);

	it('keeps simultaneous session lifecycles isolated', () => {
		const otherDecoration = { dispose: vi.fn() } as unknown as vscode.TextEditorDecorationType;
		vi.mocked(vscode.window.createTextEditorDecorationType).mockReturnValueOnce(otherDecoration);
		const other = new PerfTipsProvider({ id: 'second' } as vscode.DebugSession);
		other.onWillStartSession();
		stop();
		other.onWillStopSession();
		respond();
		expect(otherDecoration.dispose).toHaveBeenCalledOnce();
		expect(decoration.dispose).not.toHaveBeenCalled();
		expect(editor.setDecorations).toHaveBeenCalledOnce();
	});
});
