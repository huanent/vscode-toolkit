import * as vscode from 'vscode';

type ConnectionTab = 'ssh' | 'database' | 'container';
type MenuContext = {
    webviewSection?: unknown;
    dashboardTab?: unknown;
    connectionId?: unknown;
    dashboardFiltered?: unknown;
    dashboardHasScripts?: unknown;
    dashboardGroupFirst?: unknown;
    dashboardGroupLast?: unknown;
};

export function registerDashboardContextMenus(
    dispatch: (tab: ConnectionTab, request: { type: string; id: string }) => void,
): vscode.Disposable {
    return vscode.Disposable.from(
        ...['edit', 'duplicate', 'copyHost', 'runScript', 'up', 'down', 'export', 'delete', 'groupUp', 'groupDown', 'groupRename', 'groupDelete'].map(action =>
            vscode.commands.registerCommand(`vscode-toolkit.dashboard.${action}`, (request?: MenuContext) => {
                const tab = request?.dashboardTab;
                if ((tab !== 'ssh' && tab !== 'database' && tab !== 'container') || typeof request?.connectionId !== 'string') return;
                const groupAction = action.startsWith('group');
                if (request.webviewSection !== (groupAction ? 'sshGroup' : 'connectionItem')) return;
                if (groupAction && tab !== 'ssh') return;
                if ((action === 'copyHost' && tab === 'container') || (action === 'runScript' && (tab !== 'ssh' || request.dashboardHasScripts !== true))) return;
                if (['up', 'down', 'groupUp', 'groupDown'].includes(action) && request.dashboardFiltered === true) return;
                if ((action === 'groupUp' && request.dashboardGroupFirst === true) || (action === 'groupDown' && request.dashboardGroupLast === true)) return;
                const type = tab === 'container' && (action === 'up' || action === 'down')
                    ? (action === 'up' ? 'moveUp' : 'moveDown') : action;
                dispatch(tab, { type, id: request.connectionId });
            }),
        ),
    );
}