import type { TableIndex, TableIndexChange, TableIndexDefinition } from '@/features/database/protocol';

function isIdentifier(value: unknown): value is string {
  return typeof value === 'string' && Boolean(value.trim()) && !value.includes('\0');
}

function isIndex(value: unknown): value is TableIndexDefinition {
  return typeof value === 'object' && value !== null && 'name' in value && isIdentifier(value.name) &&
    'unique' in value && typeof value.unique === 'boolean' && 'columns' in value && Array.isArray(value.columns) &&
    value.columns.length > 0 && value.columns.every(isIdentifier) && new Set(value.columns).size === value.columns.length;
}

export function isTableIndexChange(value: unknown): value is TableIndexChange {
  if (typeof value !== 'object' || value === null || !('operation' in value)) return false;
  if (value.operation === 'create') return 'index' in value && isIndex(value.index);
  if (value.operation !== 'update' && value.operation !== 'delete') return false;
  return 'original' in value && isIndex(value.original) &&
    (value.operation === 'delete' || ('index' in value && isIndex(value.index)));
}

export function sameIndex(left: TableIndexDefinition, right: TableIndexDefinition): boolean {
  return left.name === right.name && left.unique === right.unique && left.columns.length === right.columns.length &&
    left.columns.every((column, position) => column === right.columns[position]);
}

export function requireEditableIndex<T extends TableIndex>(indexes: T[], original: TableIndexDefinition): T {
  const current = indexes.find((index) => index.name === original.name);
  if (!current || current.readOnly || !sameIndex(current, original)) {
    throw new Error('The index changed or is read-only. Reload indexes before editing it.');
  }
  return current;
}
