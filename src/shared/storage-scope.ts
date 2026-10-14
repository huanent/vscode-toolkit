export type StorageScope = 'global' | 'workspace';

export interface StorageRoot {
  scope: StorageScope;
  directory: string;
}

export function isStorageScope(value: unknown): value is StorageScope {
  return value === 'global' || value === 'workspace';
}

export function findStorageRoot(roots: readonly StorageRoot[], scope: StorageScope): StorageRoot {
  const root = roots.find((candidate) => candidate.scope === scope);
  if (!root) throw new Error('Workspace storage requires an open workspace folder.');
  return root;
}
