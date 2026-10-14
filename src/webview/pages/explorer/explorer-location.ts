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

/** Filesystem path of an entry, e.g. `/Users/me/project/src`. */
export function getEntryPath(entry: ExplorerEntry): string {
  return decodeURIComponent(new URL(entry.uri).pathname);
}

/** Formats the current folder's filesystem path. The workspace root (`null`) has no address. */
export function formatAddress(index: ReadonlyMap<string, ExplorerEntry>, location: ExplorerLocation): string {
  const folder = location === null ? undefined : index.get(location);
  return folder ? getEntryPath(folder) : '';
}

export type AddressSegment = {
  name: string;
  /** Entry id of the folder this segment opens; `undefined` when the folder is not listed in the explorer. */
  location?: string;
};

/** Splits the current folder's filesystem path into breadcrumb segments, starting from the root. */
export function getAddressSegments(
  index: ReadonlyMap<string, ExplorerEntry>,
  location: ExplorerLocation,
): AddressSegment[] {
  const address = formatAddress(index, location);
  if (!address) return [];

  const locationByPath = new Map<string, string>();
  for (const entry of index.values()) {
    if (entry.type === 'directory') locationByPath.set(getEntryPath(entry), entry.id);
  }

  const segments: AddressSegment[] = [{ name: '/' }];
  let path = '';
  for (const name of address.split('/').filter(Boolean)) {
    path += `/${name}`;
    segments.push({ name, location: locationByPath.get(path) });
  }
  return segments;
}

/** Resolves a typed filesystem path to a directory location. Returns `undefined` when no directory matches. */
export function resolveAddress(
  index: ReadonlyMap<string, ExplorerEntry>,
  address: string,
): ExplorerLocation | undefined {
  const path = address.trim().replace(/\/+$/, '');
  if (!path) return null;

  for (const entry of index.values()) {
    if (entry.type === 'directory' && getEntryPath(entry) === path) return entry.id;
  }
  return undefined;
}
