import * as vscode from 'vscode';
import { performance } from 'node:perf_hooks';
import type { DebugProtocol as dap } from '@vscode/debugprotocol';

export function createPerfTipsTracker(session: vscode.DebugSession): PerfTipsProvider | undefined {
	if (!vscode.workspace.getConfiguration('toolkit.perftips').get<boolean>('enabled', true)) {
		return undefined;
	}
	return new PerfTipsProvider(session);
}

export class PerfTipsProvider implements vscode.DebugAdapterTracker {
	private decorationType: vscode.TextEditorDecorationType | undefined;
	private editorListener: vscode.Disposable | undefined;
	private executionStartedTimestamp: number | undefined;
	private executionTime: number | undefined;
	private currentThread: number | undefined;
	private stackTraceReqNumber: number | undefined;
	private resumeReqNumber: number | undefined;
	private linesStartAt1 = true;
	private target: { uri: string; line: number } | undefined;
	private readonly decoratedEditors = new Set<vscode.TextEditor>();

	constructor(private readonly session: vscode.DebugSession) {}

	onWillStartSession() {
		this.dispose();
		this.decorationType = vscode.window.createTextEditorDecorationType({
			after: {
				color: new vscode.ThemeColor('editorCodeLens.foreground'),
				textDecoration: 'none',
				margin: '0 0 0 2rem',
			},
			rangeBehavior: vscode.DecorationRangeBehavior.ClosedOpen,
		});
		this.editorListener = vscode.window.onDidChangeVisibleTextEditors(() => this.render());
	}

	onWillStopSession() {
		this.dispose();
	}
	onExit() {
		this.dispose();
	}
	onError() {
		this.dispose();
	}

	private clearStop() {
		this.currentThread = undefined;
		this.stackTraceReqNumber = undefined;
		this.executionTime = undefined;
		this.target = undefined;
		this.clearDecorations();
	}

	private clearDecorations() {
		if (this.decorationType) {
			for (const editor of this.decoratedEditors) {
				editor.setDecorations(this.decorationType, []);
			}
		}
		this.decoratedEditors.clear();
	}

	private dispose() {
		this.editorListener?.dispose();
		this.editorListener = undefined;
		this.clearStop();
		this.executionStartedTimestamp = undefined;
		this.resumeReqNumber = undefined;
		this.decorationType?.dispose();
		this.decorationType = undefined;
	}

	private onStoppedEvent(event: dap.StoppedEvent) {
		const started = this.executionStartedTimestamp;
		this.executionStartedTimestamp = undefined;
		this.resumeReqNumber = undefined;
		this.clearStop();
		if (event.body.preserveFocusHint || started === undefined) return;
		this.executionTime = performance.now() - started;
		this.currentThread = event.body.threadId;
	}

	private onStackTraceRequest(request: dap.StackTraceRequest) {
		if (this.currentThread === undefined || this.executionTime === undefined) return;
		if (request.arguments.threadId !== this.currentThread || request.arguments.startFrame) return;
		this.stackTraceReqNumber = request.seq;
	}

	private onStackTraceResponse(response: dap.StackTraceResponse) {
		if (
			!this.decorationType ||
			this.stackTraceReqNumber === undefined ||
			response.request_seq !== this.stackTraceReqNumber
		)
			return;
		this.stackTraceReqNumber = undefined;
		if (!response.success) return;
		const frame = response.body?.stackFrames?.[0];
		if (!frame?.source) return;
		const line = frame.line - (this.linesStartAt1 ? 1 : 0);
		if (!Number.isInteger(line) || line < 0) return;
		try {
			const uri = vscode.debug.asDebugSourceUri(frame.source, this.session).toString();
			this.target = { uri, line };
			this.render();
		} catch {
			this.target = undefined;
			this.clearDecorations();
		}
	}

	private render() {
		this.clearDecorations();
		if (!this.decorationType || !this.target || this.executionTime === undefined) return;
		for (const editor of vscode.window.visibleTextEditors) {
			if (
				editor.document.uri.toString() !== this.target.uri ||
				this.target.line >= editor.document.lineCount
			)
				continue;
			const position = editor.document.lineAt(this.target.line).range.end;
			editor.setDecorations(this.decorationType, [
				{
					range: new vscode.Range(position, position),
					renderOptions: {
						after: { contentText: `${this.executionTime.toFixed(1)} ms debug interval` },
					},
					hoverMessage:
						'Time from a debug resume request (or continued event) to a stop event, including debugger and communication overhead. Not a code execution benchmark.',
				},
			]);
			this.decoratedEditors.add(editor);
		}
	}

	onDidSendMessage(message: dap.ProtocolMessage) {
		if (!this.decorationType) return;
		if (message.type === 'event') {
			switch ((message as dap.Event).event) {
				case 'stopped':
					this.onStoppedEvent(message as dap.StoppedEvent);
					break;
				case 'continued':
					this.clearStop();
					this.executionStartedTimestamp ??= performance.now();
					break;
				case 'terminated':
					this.dispose();
					break;
			}
		} else if (message.type === 'response') {
			const response = message as dap.Response;
			if (response.request_seq === this.resumeReqNumber && !response.success) {
				this.executionStartedTimestamp = undefined;
				this.resumeReqNumber = undefined;
				this.clearStop();
			}
			if (response.command === 'stackTrace')
				this.onStackTraceResponse(message as dap.StackTraceResponse);
		}
	}

	onWillReceiveMessage(message: dap.ProtocolMessage) {
		if (message.type !== 'request' || !this.decorationType) return;
		const request = message as dap.Request;
		switch (request.command) {
			case 'initialize':
				this.linesStartAt1 = (message as dap.InitializeRequest).arguments.linesStartAt1 !== false;
				break;
			case 'next':
			case 'stepIn':
			case 'stepOut':
			case 'continue':
			case 'stepBack':
			case 'reverseContinue':
			case 'restartFrame':
			case 'goto':
				this.clearStop();
				this.executionStartedTimestamp = performance.now();
				this.resumeReqNumber = request.seq;
				break;
			case 'restart':
			case 'disconnect':
			case 'terminate':
				this.clearStop();
				this.executionStartedTimestamp = undefined;
				this.resumeReqNumber = undefined;
				break;
			case 'stackTrace':
				this.onStackTraceRequest(message as dap.StackTraceRequest);
				break;
		}
	}
}
