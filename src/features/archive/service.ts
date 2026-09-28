import type * as vscode from 'vscode';
import * as yauzl from 'yauzl';
import type { ArchiveTreeEntry } from './protocol';

export function validateArchiveUri(uri: vscode.Uri): void {
  if (!/\.(zip|vsix)$/i.test(uri.path)) throw new Error('Only ZIP or VSIX archives can be previewed.');
}

export async function readArchiveTree(uri: vscode.Uri): Promise<ArchiveTreeEntry[]> {
  validateArchiveUri(uri);
  if (uri.scheme !== 'file') {
    throw new Error(
      'Remote ZIP or VSIX preview requires a remote directory-reading connection. The archive will not be downloaded.',
    );
  }

  const zip = await yauzl.openPromise(uri.fsPath, { validateEntrySizes: true });
  const root: ArchiveTreeEntry = { name: '', type: 'directory', size: 0, children: [] };
  const nodes = new Map<ArchiveTreeEntry, Map<string, ArchiveTreeEntry>>();
  nodes.set(root, new Map());
  let timedOut = false;
  const timer = setTimeout(() => {
    timedOut = true;
    zip.close();
  }, 30000);

  try {
    for await (const entry of zip.eachEntry()) {
      if (timedOut) throw new Error('Archive preview timed out.');
      const parts = getPathParts(entry.fileName);
      if (parts.length > 100) {
        throw new Error('The archive contains an unsafe or excessively nested path.');
      }

      let parent = root;
      const isDirectoryEntry = entry.fileName.endsWith('/');
      for (let index = 0; index < parts.length; index++) {
        const directory = index < parts.length - 1 || isDirectoryEntry;
        const children = nodes.get(parent)!;
        const name = parts[index];
        let node = children.get(name);
        if (!node) {
          node = {
            name,
            type: directory ? 'directory' : 'file',
            size: directory ? 0 : entry.uncompressedSize,
            ...(directory ? { children: [] } : {}),
          };
          children.set(name, node);
          parent.children!.push(node);
        } else if ((node.type === 'directory') !== directory) {
          throw new Error('Conflicting archive paths.');
        }
        if (directory && !nodes.has(node)) nodes.set(node, new Map());
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

function getPathParts(fileName: string): string[] {
  const parts: string[] = [];
  let start = 0;
  for (let index = 0; index <= fileName.length; index++) {
    if (index !== fileName.length && fileName[index] !== '/') continue;
    if (index > start) {
      const part = fileName.slice(start, index);
      if (part === '..' || part.includes('\0')) {
        throw new Error('The archive contains an unsafe or excessively nested path.');
      }
      if (part !== '.') parts.push(part);
    }
    start = index + 1;
  }
  return parts;
}

const entryNameCollator = new Intl.Collator(undefined, { numeric: true });

function sortEntries(entries: ArchiveTreeEntry[]): void {
  entries.sort((left, right) =>
    left.type === right.type ? entryNameCollator.compare(left.name, right.name) : left.type === 'directory' ? -1 : 1,
  );
  for (const entry of entries) if (entry.children) sortEntries(entry.children);
}
