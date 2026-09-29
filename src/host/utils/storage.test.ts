import { join } from 'node:path';
import { describe, expect, it, vi } from 'vitest';

vi.mock('vscode', () => ({
  workspace: {
    getConfiguration: () => ({ get: () => '' }),
  },
}));

import { resolveStorageDirectory } from './storage';

describe('storage', () => {
  it('resolves a directory from the configured storage path', () => {
    const context = { globalStorageUri: { fsPath: '/extension/global' } } as never;

    expect(resolveStorageDirectory(context, 'temp')).toBe(join('/extension/global', 'temp'));
  });
});
