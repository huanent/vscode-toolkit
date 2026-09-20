import * as vscode from 'vscode';
import { getStorageUri } from '../storagePath';

type Kind = 'ssh' | 'database' | 'container';
interface Store {
    getServers(): { id: string; group: string }[];
    renameGroup(group: string, name: string): Promise<void>;
    deleteServers(ids: string[]): Promise<void>;
}
const stores = new Map<Kind, Store>();
let order: string[] = [];
let queue = Promise.resolve();

export function registerConnectionStore(kind: Kind, store: Store): vscode.Disposable {
    stores.set(kind, store);
    return { dispose: () => { stores.delete(kind); } };
}

export async function loadConnectionOrder(context: vscode.ExtensionContext): Promise<string[]> {
    try {
        const data: unknown = JSON.parse(Buffer.from(await vscode.workspace.fs.readFile(
            vscode.Uri.joinPath(getStorageUri(context, 'connection'), 'order.json'),
        )).toString('utf8'));
        order = Array.isArray(data) ? data.filter((value): value is string => typeof value === 'string') : [];
    } catch (error) {
        if (!(error instanceof vscode.FileSystemError) || error.code !== 'FileNotFound') throw error;
        order = [];
    }
    return order;
}

export function manageConnection(
    context: vscode.ExtensionContext,
    kind: Kind | 'connection',
    type: string,
    id: string,
    publish: (order: string[]) => void,
): Promise<void> {
    const pending = queue.then(async () => {
        const connections = [...stores].flatMap(([connectionType, store]) => store.getServers().map(server => ({
            ...server, group: server.group.trim(), key: `${connectionType}:${server.id}`,
        })));
        const positions = new Map(order.map((key, index) => [key, index]));
        connections.sort((left, right) => (positions.get(left.key) ?? Infinity) - (positions.get(right.key) ?? Infinity));
        if (type === 'groupRename') {
            const name = await vscode.window.showInputBox({
                title: 'Rename connection group', value: id,
                validateInput: value => !value.trim() ? 'Enter a group name.' :
                    value.trim() !== id && connections.some(server => server.group === value.trim()) ? 'A group with this name already exists.' : undefined,
            });
            if (name?.trim() && name.trim() !== id) {
                for (const store of stores.values()) await store.renameGroup(id, name.trim());
            }
            return;
        }
        if (type === 'groupDelete') {
            const members = connections.filter(server => server.group === id);
            if (members.length && await vscode.window.showWarningMessage(
                `Delete group "${id}" and its ${members.length} connections?`, { modal: true }, 'Delete',
            ) === 'Delete') {
                for (const store of stores.values()) await store.deleteServers(store.getServers().filter(server => server.group.trim() === id).map(server => server.id));
            }
            return;
        }
        const step = type === 'up' || type === 'groupUp' ? -1 : 1;
        if (type === 'groupUp' || type === 'groupDown') {
            const groups = [...new Set(connections.map(server => server.group).filter(Boolean))];
            const index = groups.indexOf(id);
            const target = index + step;
            if (index < 0 || target < 0 || target >= groups.length) return;
            [groups[index], groups[target]] = [groups[target], groups[index]];
            order = [...groups.flatMap(group => connections.filter(server => server.group === group)), ...connections.filter(server => !server.group)].map(server => server.key);
        } else {
            const index = connections.findIndex(server => server.key === `${kind}:${id}`);
            if (index < 0) return;
            let target = index + step;
            while (target >= 0 && target < connections.length && connections[target].group !== connections[index].group) target += step;
            if (target < 0 || target >= connections.length) return;
            [connections[index], connections[target]] = [connections[target], connections[index]];
            order = connections.map(server => server.key);
        }
        const directory = getStorageUri(context, 'connection');
        await vscode.workspace.fs.createDirectory(directory);
        const temporary = vscode.Uri.joinPath(directory, `.order.${crypto.randomUUID()}.tmp`);
        await vscode.workspace.fs.writeFile(temporary, Buffer.from(JSON.stringify(order)));
        await vscode.workspace.fs.rename(temporary, vscode.Uri.joinPath(directory, 'order.json'), { overwrite: true });
        publish(order);
    });
    queue = pending.catch(() => { });
    return pending;
}