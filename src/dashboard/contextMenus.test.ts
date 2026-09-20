import { readFileSync } from 'node:fs';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import * as vscode from 'vscode';
import { registerDashboardContextMenus } from './contextMenus';

vi.mock('vscode', () => ({
    commands: { registerCommand: vi.fn(() => ({ dispose: vi.fn() })) },
    Disposable: { from: (...disposables: { dispose(): void }[]) => ({ dispose: () => disposables.forEach(disposable => disposable.dispose()) }) },
}));

describe('Dashboard native context menus', () => {
    const dispatch = vi.fn();
    beforeEach(() => {
        vi.mocked(vscode.commands.registerCommand).mockClear();
        registerDashboardContextMenus(dispatch);
    });
    function invoke(action: string, context?: Record<string, unknown>) {
        const registration = vi.mocked(vscode.commands.registerCommand).mock.calls.find(([command]) => command === `vscode-toolkit.dashboard.${action}`);
        expect(registration).toBeDefined();
        registration![1](context);
    }
    const connection = { webviewSection: 'connectionItem', dashboardTab: 'ssh', connectionId: 'server-1' };

    it.each(['ssh', 'database', 'container'])('routes connection operations for %s', dashboardTab => {
        for (const action of ['edit', 'duplicate', 'export', 'delete', 'up', 'down']) {
            invoke(action, { ...connection, dashboardTab });
            expect(dispatch).toHaveBeenLastCalledWith(dashboardTab, { type: action, id: 'server-1' });
        }
    });

    it('preserves search and script restrictions', () => {
        invoke('up', { ...connection, dashboardFiltered: true });
        invoke('down', { ...connection, dashboardFiltered: true });
        invoke('runScript', connection);
        invoke('runScript', { ...connection, dashboardTab: 'database', dashboardHasScripts: true });
        invoke('copyHost', { ...connection, dashboardTab: 'container' });
        expect(dispatch).not.toHaveBeenCalled();
        invoke('runScript', { ...connection, dashboardHasScripts: true });
        expect(dispatch).toHaveBeenLastCalledWith('ssh', { type: 'runScript', id: 'server-1' });
        invoke('copyHost', connection);
        expect(dispatch).toHaveBeenLastCalledWith('ssh', { type: 'copyHost', id: 'server-1' });
    });

    it.each(['ssh', 'connection'])('routes %s group names and preserves group movement boundaries', dashboardTab => {
        const group = { ...connection, dashboardTab, webviewSection: 'sshGroup', connectionId: 'Production' };
        invoke('groupUp', { ...group, dashboardGroupFirst: true });
        invoke('groupDown', { ...group, dashboardGroupLast: true });
        invoke('groupUp', { ...group, dashboardFiltered: true });
        invoke('groupDown', { ...group, dashboardFiltered: true });
        expect(dispatch).not.toHaveBeenCalled();
        for (const type of ['groupUp', 'groupDown', 'groupRename', 'groupDelete']) {
            invoke(type, group);
            expect(dispatch).toHaveBeenLastCalledWith(dashboardTab, { type, id: 'Production' });
        }
    });

    it('ignores missing or mismatched context', () => {
        invoke('delete');
        invoke('delete', { ...connection, connectionId: 123 });
        invoke('delete', { ...connection, dashboardTab: 'workflow' });
        invoke('delete', { ...connection, webviewSection: 'sshGroup' });
        invoke('groupDelete', connection);
        invoke('groupDelete', { ...connection, webviewSection: 'sshGroup', dashboardTab: 'database' });
        expect(dispatch).not.toHaveBeenCalled();
    });

    it('declares registered commands only in dashboard context menus and disposes them', () => {
        const manifest = JSON.parse(readFileSync('package.json', 'utf8'));
        for (const [command] of vi.mocked(vscode.commands.registerCommand).mock.calls) {
            expect(manifest.contributes.commands).toContainEqual(expect.objectContaining({ command }));
            expect(manifest.contributes.menus['webview/context']).toContainEqual(expect.objectContaining({ command, when: expect.stringContaining("webviewId == 'vscode-toolkit.dashboard'") }));
            expect(manifest.contributes.menus.commandPalette).toContainEqual({ command, when: 'false' });
        }
        const disposable = registerDashboardContextMenus(dispatch);
        disposable.dispose();
        for (const result of vi.mocked(vscode.commands.registerCommand).mock.results.slice(-12)) {
            expect(result.value.dispose).toHaveBeenCalledOnce();
        }
    });
});