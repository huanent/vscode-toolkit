import * as vscode from 'vscode';
import { DebugProtocol as dap } from '@vscode/debugprotocol';

export class PerfTipsProvider implements vscode.DebugAdapterTracker {
	private decorationType: vscode.TextEditorDecorationType | undefined;

	onWillStartSession() {
		this.decorationType = vscode.window.createTextEditorDecorationType({
			after: {
				color: new vscode.ThemeColor('editorCodeLens.foreground'),
				textDecoration: 'none',
				margin: '0 0 0 2rem',
			},
			rangeBehavior: vscode.DecorationRangeBehavior.ClosedOpen,
		});
		this.executionStartedTimestamp = new Date();
	}

	onWillStopSession() {
		this.decorationType?.dispose();
	}

	private executionStartedTimestamp = new Date();
	private executionTime: number = 0;
	private currentThread: number | undefined = undefined;
	private stackTraceReqNumber: number = 0;

	private onStoppedEvent(e: dap.StoppedEvent) {
		if (e.body.preserveFocusHint) return;

		this.executionTime = <any>new Date() - <any>this.executionStartedTimestamp;
		this.currentThread = e.body.threadId;
	}

	private onStackTraceRequest(r: dap.StackTraceRequest) {
		if (!this.currentThread) return;
		if (r.arguments.threadId !== this.currentThread) return;
		if (r.arguments.startFrame) return;

		this.stackTraceReqNumber = r.seq;
	}

	private async onStackTraceResponse(r: dap.StackTraceResponse) {
		if (!this.decorationType) return;
		if (r.request_seq !== this.stackTraceReqNumber || !r.success || r.body.stackFrames.length < 1)
			return;

		const frame = r.body.stackFrames[0];
		if (!frame.source) return;

		const srcuri = vscode.debug.asDebugSourceUri(frame.source);
		const editor = await vscode.window.showTextDocument(srcuri);

		const pos = new vscode.Position(frame.line - 1, Number.MAX_SAFE_INTEGER);
		const decorators = [
			{
				range: new vscode.Range(pos, pos),
				renderOptions: {
					after: {
						contentText: `≤${this.executionTime}ms elapsed`,
					},
				},
			},
		];
		editor.setDecorations(this.decorationType, decorators);
	}

	onDidSendMessage(msg: dap.ProtocolMessage) {
		if (msg.type === 'event' && (msg as dap.Event).event === 'stopped') {
			this.onStoppedEvent(msg as dap.StoppedEvent);
			return;
		}

		if (msg.type !== 'response' || (msg as dap.Response).command !== 'stackTrace') return;

		this.onStackTraceResponse(msg as dap.StackTraceResponse);
	}

	onWillReceiveMessage(msg: dap.ProtocolMessage) {
		if (msg.type !== 'request') return;

		switch ((msg as dap.Request).command as string) {
			case 'next':
			case 'stepIn':
			case 'stepOut':
			case 'continue':
				this.executionStartedTimestamp = new Date();
				break;
			case 'stackTrace':
				this.onStackTraceRequest(msg as dap.StackTraceRequest);
				break;
			default:
				return;
		}
	}
}
