import type * as vscode from 'vscode';
import * as yauzl from 'yauzl';
import type { ArchiveTreeEntry } from './protocol';

export function validateArchiveUri(uri: vscode.Uri): void {
    if (!/\.zip$/i.test(uri.path)) throw new Error('Only ZIP archives can be previewed.');
}

export async function readArchiveTree(uri: vscode.Uri): Promise<ArchiveTreeEntry[]> {
    validateArchiveUri(uri);
    if (uri.scheme !== 'file') {
        throw new Error('Remote ZIP preview requires a remote directory-reading connection. The archive will not be downloaded.');
    }
    const zip = await yauzl.openPromise(uri.fsPath, { validateEntrySizes: true });
    const root: ArchiveTreeEntry = { name: '', type: 'directory', size: 0, children: [] };
    const nodes = new Map<string, ArchiveTreeEntry>();
    let timedOut = false;
    const timer = setTimeout(() => { timedOut = true; zip.close(); }, 30000);
    try {
        for await (const entry of zip.eachEntry()) {
            if (timedOut) throw new Error('Archive preview timed out.');
            const parts = entry.fileName.split('/').filter(part => part && part !== '.');
            if (parts.length > 100 || parts.some(part => part === '..' || part.includes('\0'))) {
                throw new Error('The archive contains an unsafe or excessively nested path.');
            }
            let parent = root;
            for (let index = 0; index < parts.length; index++) {
                const key = parts.slice(0, index + 1).join('/');
                const directory = index < parts.length - 1 || entry.fileName.endsWith('/');
                let node = nodes.get(key);
                if (!node) {
                    node = { name: parts[index], type: directory ? 'directory' : 'file', size: directory ? 0 : entry.uncompressedSize, ...(directory ? { children: [] } : {}) };
                    nodes.set(key, node);
                    parent.children!.push(node);
                } else if ((node.type === 'directory') !== directory) {
                    throw new Error('Conflicting archive paths.');
                }
                parent = node;
            }
        }
        if (timedOut) throw new Error('Archive preview timed out.');
        sortEntries(root.children!);
        return root.children!;
    } finally {
        clearTimeout(timer);
        zip.close();
    }
}

function sortEntries(entries: ArchiveTreeEntry[]): void {
    entries.sort((left, right) => left.type === right.type ? left.name.localeCompare(right.name, undefined, { numeric: true }) : left.type === 'directory' ? -1 : 1);
    for (const entry of entries) if (entry.children) sortEntries(entry.children);
}