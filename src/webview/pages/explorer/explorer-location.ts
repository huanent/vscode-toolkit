import type { ExplorerEntry } from '@/features/explorer/protocol';
import type { AddressSegment } from '@/webview/components/address-breadcrumb';

/** URI of the current folder. `null` requests the system root. */
export type ExplorerLocation = string | null;

export function indexEntries(entries: readonly ExplorerEntry[]): Map<string, ExplorerEntry> {
  return new Map(entries.map((entry) => [entry.id, entry]));
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

/** Formats the current folder's filesystem path. */
export function formatAddress(index: ReadonlyMap<string, ExplorerEntry>, location: ExplorerLocation): string {
  const folder = location === null ? undefined : index.get(location);
  return folder ? getEntryPath(folder) : '';
}

export function getAddressSegments(
  index: ReadonlyMap<string, ExplorerEntry>,
  location: ExplorerLocation,
): AddressSegment[] {
  return location === null ? [] : [...index.values()].map((entry) => ({ name: entry.name, location: entry.id }));
}
