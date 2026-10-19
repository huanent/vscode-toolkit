import * as vscode from 'vscode';
import * as yauzl from 'yauzl';
import type { SshService } from '@/features/ssh/ssh-service';
import type { ArchiveTreeEntry } from './protocol';

let remoteSsh: SshService | undefined;

export function registerRemoteArchive(ssh: SshService): vscode.Disposable {
  remoteSsh = ssh;
  return new vscode.Disposable(() => {
    if (remoteSsh === ssh) remoteSsh = undefined;
  });
}

export function validateArchiveUri(uri: vscode.Uri): void {
  if (!/\.(zip|vsix)$/i.test(uri.path)) throw new Error('Only ZIP or VSIX archives can be previewed.');
}

export type ArchiveIndex = ReadonlyMap<string, readonly ArchiveTreeEntry[]>;

export async function readArchiveIndex(uri: vscode.Uri): Promise<ArchiveIndex> {
  validateArchiveUri(uri);
  if (uri.scheme === 'toolkit-sftp') {
    if (!remoteSsh) throw new Error('Remote archive preview is not available.');
    const argument = `'${uri.path.replace(/'/g, "'\\''")}'`;
    const result = await remoteSsh.runCommand(
      uri.authority,
      `command -v unzip >/dev/null 2>&1 || { printf '%s\\n' 'Remote ZIP / VSIX preview requires unzip on the SSH server.' >&2; exit 127; }\nLC_ALL=C exec unzip -l ${argument}`,
      AbortSignal.timeout(60000),
    );
    if (result.exitCode !== 0) throw new Error(result.stderr.trim() || 'Remote archive preview failed.');
    if (result.stdout.includes('[Output truncated at '))
      throw new Error('Remote archive directory exceeds the SSH output limit.');
    return buildArchiveIndex(parseUnzipListing(result.stdout));
  }
  if (uri.scheme !== 'file') {
    throw new Error(
      'Remote ZIP or VSIX preview requires a remote directory-reading connection. The archive will not be downloaded.',
    );
  }

  const zip = await yauzl.openPromise(uri.fsPath, { validateEntrySizes: true });
  return readZipIndex(zip);
}

function parseUnzipListing(output: string): Pick<yauzl.Entry, 'fileName' | 'uncompressedSize'>[] {
  const entries: Pick<yauzl.Entry, 'fileName' | 'uncompressedSize'>[] = [];
  let separators = 0;
  for (const line of output.split(/\r?\n/)) {
    if (/^\s*-+(?:\s+-+)+\s*$/.test(line)) {
      separators++;
      if (separators === 2) break;
      continue;
    }
    if (separators !== 1) continue;
    const match = /^\s*(\d+)\s+\d{2,4}-\d{2}-\d{2,4}\s+\d{2}:\d{2} {3}(.+)$/.exec(line);
    if (!match || !Number.isSafeInteger(Number(match[1]))) {
      throw new Error('Invalid remote unzip directory output.');
    }
    entries.push({ fileName: match[2], uncompressedSize: Number(match[1]) });
  }
  if (separators !== 2) throw new Error('Invalid remote unzip directory output.');
  return entries;
}

async function readZipIndex(zip: yauzl.ZipFile): Promise<ArchiveIndex> {
  let timedOut = false;
  const timer = setTimeout(() => {
    timedOut = true;
    zip.close();
  }, 30000);

  try {
    const index = await buildArchiveIndex(zip.eachEntry());
    if (timedOut) throw new Error('Archive preview timed out.');
    return index;
  } finally {
    clearTimeout(timer);
    zip.close();
  }
}

async function buildArchiveIndex(
  entries:
    | AsyncIterable<Pick<yauzl.Entry, 'fileName' | 'uncompressedSize'>>
    | Iterable<Pick<yauzl.Entry, 'fileName' | 'uncompressedSize'>>,
): Promise<ArchiveIndex> {
  const directories = new Map<string, Map<string, ArchiveTreeEntry>>([['', new Map()]]);
  for await (const entry of entries) {
    const parts = getPathParts(entry.fileName);
    if (parts.length > 100) {
      throw new Error('The archive contains an unsafe or excessively nested path.');
    }

    let parent = '';
    for (let position = 0; position < parts.length; position++) {
      const name = parts[position];
      const directory = position < parts.length - 1 || entry.fileName.endsWith('/');
      const children = directories.get(parent)!;
      const previous = children.get(name);
      if (previous && (previous.type === 'directory') !== directory) throw new Error('Conflicting archive paths.');
      if (!previous)
        children.set(name, {
          name,
          type: directory ? 'directory' : 'file',
          size: directory ? 0 : entry.uncompressedSize,
        });
      parent = parent ? `${parent}/${name}` : name;
      if (directory && !directories.has(parent)) directories.set(parent, new Map());
    }
  }

  const index = new Map<string, readonly ArchiveTreeEntry[]>();
  for (const [path, nodes] of directories) {
    const children = [...nodes.values()];
    sortEntries(children);
    index.set(path, children);
  }
  return index;
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
}
