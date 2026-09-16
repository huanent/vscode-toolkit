import { describe, expect, it, vi } from 'vitest';
import * as vscode from 'vscode';
import { ResultView } from './resultView';
import type { Result } from './protocol';

vi.mock('vscode', () => ({
    commands: { executeCommand: vi.fn(async () => undefined) },
    Uri: { joinPath: vi.fn(() => ({})) },
}));
vi.mock('../webview', () => ({ getWebviewHtml: () => '<html></html>' }));

const http: Result = { type: 'http', data: { method: 'GET', url: 'https://example.com', state: 'success' } };
const table: Result = { type: 'table', data: { kind: 'rows', columns: ['id'], rows: [['1']], summary: '1 row' } };

function createView() {
    let receive = (_message: { type: string }) => { };
    let visibilityChanged = () => { };
    let disposed = () => { };
    const view = {
        visible: true,
        show: vi.fn(),
        webview: {
            postMessage: vi.fn(),
            onDidReceiveMessage: (listener: typeof receive) => { receive = listener; },
        },
        onDidChangeVisibility: (listener: () => void) => { visibilityChanged = listener; },
        onDidDispose: (listener: () => void) => { disposed = listener; },
    };
    return {
        view,
        resolve: (provider: ResultView) => provider.resolveWebviewView(view as unknown as vscode.WebviewView),
        ready: () => receive({ type: 'ready' }),
        cancel: () => receive({ type: 'cancelWorkflow' }),
        visibilityChanged: () => visibilityChanged(),
        dispose: () => disposed(),
    };
}

describe('shared result view', () => {
    it('routes panel cancellation only for a running workflow', async () => {
        const provider = new ResultView({} as vscode.Uri);
        const harness = createView();
        harness.resolve(provider);
        const workflow: Result = { type: 'workflow', data: { name: 'Build', state: 'running', summary: 'Starting', output: '' } };
        await provider.show(workflow);
        vi.mocked(vscode.commands.executeCommand).mockClear();
        harness.cancel();
        expect(vscode.commands.executeCommand).toHaveBeenCalledExactlyOnceWith('vscode-toolkit.cancelWorkflow');
        vi.mocked(vscode.commands.executeCommand).mockClear();
        for (const state of ['stopping', 'success', 'error', 'cancelled'] as const) {
            workflow.data.state = state;
            harness.cancel();
        }
        expect(vscode.commands.executeCommand).not.toHaveBeenCalled();
        await provider.show(http);
        vi.mocked(vscode.commands.executeCommand).mockClear();
        harness.cancel();
        expect(vscode.commands.executeCommand).not.toHaveBeenCalled();
    });

    it('updates workflow output without revealing the view or replacing another result', async () => {
        const provider = new ResultView({} as vscode.Uri);
        const harness = createView();
        harness.resolve(provider);
        harness.ready();
        const workflow: Result = { type: 'workflow', data: { name: 'Build', state: 'running', summary: 'Starting', output: '' } };
        await provider.show(workflow);
        workflow.data.output = 'Building...';
        provider.update(workflow);
        expect(harness.view.show).toHaveBeenCalledTimes(1);
        expect(harness.view.webview.postMessage).toHaveBeenLastCalledWith({ type: 'result', result: workflow });
        harness.view.visible = false;
        harness.view.webview.postMessage.mockClear();
        workflow.data.output += '\nDone';
        provider.update(workflow);
        expect(harness.view.webview.postMessage).not.toHaveBeenCalled();
        harness.view.visible = true;
        harness.visibilityChanged();
        expect(harness.view.webview.postMessage).toHaveBeenLastCalledWith({ type: 'result', result: workflow });
        await provider.show(http);
        provider.update(workflow);
        expect(harness.view.webview.postMessage).toHaveBeenLastCalledWith({ type: 'result', result: http });
    });

    it('shows HTTP and table results in the same view and resets SQL export', async () => {
        const provider = new ResultView({} as vscode.Uri);
        const harness = createView();
        harness.resolve(provider);
        harness.ready();
        await provider.show(table, true);
        expect(harness.view.webview.postMessage).toHaveBeenLastCalledWith({ type: 'result', result: table });
        await provider.show(http);
        expect(harness.view.webview.postMessage).toHaveBeenLastCalledWith({ type: 'result', result: http });
        expect(harness.view.show).toHaveBeenCalledTimes(2);
        expect(vscode.commands.executeCommand).toHaveBeenCalledWith('setContext', 'vscode-toolkit.servers.mysqlSqlResultsExportable', false);
    });

    it('sends only the latest result when the view becomes ready', async () => {
        const provider = new ResultView({} as vscode.Uri);
        await provider.show(http);
        await provider.show(table, true);
        expect(vscode.commands.executeCommand).toHaveBeenCalledWith(`${ResultView.viewType}.focus`);
        const harness = createView();
        harness.resolve(provider);
        expect(harness.view.webview.postMessage).not.toHaveBeenCalled();
        harness.ready();
        expect(harness.view.webview.postMessage).toHaveBeenCalledExactlyOnceWith({ type: 'result', result: table });
    });

    it('restores the latest result after hiding or disposing the view', async () => {
        const provider = new ResultView({} as vscode.Uri);
        const harness = createView();
        harness.resolve(provider);
        harness.ready();
        harness.view.visible = false;
        await provider.show(table, true);
        expect(harness.view.webview.postMessage).not.toHaveBeenCalled();
        harness.view.visible = true;
        harness.visibilityChanged();
        expect(harness.view.webview.postMessage).toHaveBeenLastCalledWith({ type: 'result', result: table });
        harness.dispose();
        const restored = createView();
        restored.resolve(provider);
        restored.ready();
        expect(restored.view.webview.postMessage).toHaveBeenCalledExactlyOnceWith({ type: 'result', result: table });
    });
});