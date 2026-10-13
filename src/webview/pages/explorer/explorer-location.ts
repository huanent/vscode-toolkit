import type { ExplorerEntry } from '@/features/explorer/protocol';

/** Entry id of the current folder. `null` is the workspace root, which lists the workspace folders. */
export type ExplorerLocation = string | null;

export function indexEntries(entries: readonly ExplorerEntry[]): Map<string, ExplorerEntry> {
  const index = new Map<string, ExplorerEntry>();
  const visit = (items: readonly ExplorerEntry[]) => {
    for (const item of items) {
      index.set(item.id, item);
      visit(item.children ?? []);
    }
  };
  visit(entries);
  return index;
}

export function sortEntries(entries: readonly ExplorerEntry[]): ExplorerEntry[] {
  return [...entries].sort((first, second) => {
    if (first.type !== second.type) return first.type === 'directory' ? -1 : 1;
    return first.name.localeCompare(second.name);
  });
}

/** Formats the location as slash-separated names, e.g. `project/src/features`. */
export function formatAddress(index: ReadonlyMap<string, ExplorerEntry>, location: ExplorerLocation): string {
  if (location === null) return '';
  const segments = location.split('/');
  return segments.map((_, depth) => index.get(segments.slice(0, depth + 1).join('/'))?.name ?? '').join('/');
}

/** Resolves a typed address to a directory location. Returns `undefined` when no directory matches. */
export function resolveAddress(entries: readonly ExplorerEntry[], address: string): ExplorerLocation | undefined {
  const names = address
    .split('/')
    .map((segment) => segment.trim())
    .filter(Boolean);
  if (!names.length) return null;

  let candidates: readonly ExplorerEntry[] = entries;
  let target: ExplorerEntry | undefined;
  for (const name of names) {
    target = candidates.find((entry) => entry.name === name);
    if (!target) return undefined;
    candidates = target.children ?? [];
  }
  return target?.type === 'directory' ? target.id : undefined;
}
