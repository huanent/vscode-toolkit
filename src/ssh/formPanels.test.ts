import { beforeEach, describe, expect, it, vi } from 'vitest';
import * as vscode from 'vscode';
import { createSshFormPanels } from './formPanels';
import { handleMessage } from './serverForm';
import type { Server } from './server';
import type { ServerStore } from './serverStore';

vi.mock('vscode', () => ({
    window: { createWebviewPanel: vi.fn(), showErrorMessage: vi.fn() },
    ViewColumn: { Active: -1 },
    Uri: { joinPath: vi.fn() },
    ThemeIcon: class { },
}));
vi.mock('../webview', () => ({ getWebviewHtml: () => '<html></html>' }));
vi.mock('./serverForm', () => ({ handleMessage: vi.fn(async () => { }) }));

function createPanel() {
    let receive: (message: unknown) => Promise<void>;
    let close: () => void;
    const panel = {
        webview: {
            onDidReceiveMessage: vi.fn(callback => {
                receive = callback;
                return { dispose: vi.fn() };
            }),
            postMessage: vi.fn(async () => true),
        },
        onDidDispose: vi.fn(callback => { close = callback; }),
        dispose: vi.fn(() => close()),
        reveal: vi.fn(),
    };
    return { panel, send: (message: unknown) => receive(message) };
}

describe('SSH form panels', () => {
    beforeEach(() => vi.clearAllMocks());

    it('isolates connections and preserves an existing editor when reopened', async () => {
        const first = createPanel();
        const second = createPanel();
        vi.mocked(vscode.window.createWebviewPanel)
            .mockReturnValueOnce(first.panel as unknown as vscode.WebviewPanel)
            .mockReturnValueOnce(second.panel as unknown as vscode.WebviewPanel);
        const store = { getCredentials: vi.fn(async (id: string) => ({ password: id })) };
        const forms = createSshFormPanels({} as vscode.ExtensionContext, store as unknown as ServerStore);
        const firstServer = { id: 'first', name: 'First' } as Server;
        const secondServer = { id: 'second', name: 'Second' } as Server;
        forms.open(firstServer);
        forms.open(secondServer);
        await first.send({ type: 'editorReady' });
        await second.send({ type: 'editorReady' });
        forms.open(firstServer);
        expect(vscode.window.createWebviewPanel).toHaveBeenCalledTimes(2);
        expect(first.panel.reveal).toHaveBeenCalledOnce();
        expect(store.getCredentials).not.toHaveBeenCalled();
        const request = { channel: 'ssh', type: 'formMessage', sessionId: 1, message: { type: 'ready' } };
        await first.send(request);
        await second.send(request);
        expect(vi.mocked(handleMessage).mock.calls.map(call => [call[4], call[5]]))
            .toEqual([[firstServer, {}], [secondServer, {}]]);
        first.panel.dispose();
        await second.send({ ...request, message: { type: 'save' } });
        expect(vi.mocked(handleMessage).mock.calls.at(-1)?.[4]).toBe(secondServer);
        expect(second.panel.dispose).not.toHaveBeenCalled();
        forms.dispose();
    });

    it('opens independent new and duplicate forms', () => {
        vi.mocked(vscode.window.createWebviewPanel).mockImplementation(() =>
            createPanel().panel as unknown as vscode.WebviewPanel);
        const forms = createSshFormPanels({} as vscode.ExtensionContext, {} as ServerStore);
        const server = { id: 'first', name: 'First' } as Server;
        forms.open();
        forms.open();
        forms.open(server, true);
        forms.open(server, true);
        expect(vscode.window.createWebviewPanel).toHaveBeenCalledTimes(4);
        forms.dispose();
    });
});