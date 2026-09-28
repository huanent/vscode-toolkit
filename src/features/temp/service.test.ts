import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { createTempFile, getTempFilePath, readTempTree, resolveTempDirectory, validateTempFileName } from './service';

describe('temporary file service', () => {
  it('resolves the configured path, home shorthand, and global storage fallback', () => {
    expect(resolveTempDirectory('/custom/toolkit', '/extension/global', '/Users/test')).toBe(
      join('/custom/toolkit', 'temp'),
    );
    expect(resolveTempDirectory('~/toolkit-data', '/extension/global', '/Users/test')).toBe(
      join('/Users/test/toolkit-data', 'temp'),
    );
    expect(resolveTempDirectory('', '/extension/global', '/Users/test')).toBe(join('/extension/global', 'temp'));
  });

  it('reads nested files and creates the temp directory when it is missing', async () => {
    const root = await mkdtemp(join(tmpdir(), 'toolkit-temp-test-'));
    const directory = join(root, 'storage', 'temp');
    try {
      expect(await readTempTree(directory)).toEqual([]);
      await mkdir(join(directory, 'folder'));
      await writeFile(join(directory, 'folder', 'draft.txt'), 'draft');
      await writeFile(join(directory, 'note.md'), '');

      expect(await readTempTree(directory)).toEqual([
        { name: 'folder', type: 'directory', children: [{ name: 'draft.txt', type: 'file' }] },
        { name: 'note.md', type: 'file' },
      ]);
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it('creates empty files without replacing existing files', async () => {
    const root = await mkdtemp(join(tmpdir(), 'toolkit-temp-test-'));
    const directory = join(root, 'temp');
    try {
      const filePath = await createTempFile(directory, 'scratch.md');
      expect(await readFile(filePath, 'utf8')).toBe('');
      await expect(createTempFile(directory, 'scratch.md')).rejects.toMatchObject({ code: 'EEXIST' });
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it('only resolves existing regular files inside the temp directory', async () => {
    const root = await mkdtemp(join(tmpdir(), 'toolkit-temp-test-'));
    const directory = join(root, 'temp');
    try {
      const filePath = await createTempFile(directory, 'note.md');
      expect(await getTempFilePath(directory, 'note.md')).toBe(filePath);
      await expect(getTempFilePath(directory, '../outside.txt')).rejects.toThrow('Invalid temporary file path.');
      await mkdir(join(directory, 'folder'));
      await expect(getTempFilePath(directory, 'folder')).rejects.toThrow('Only regular temporary files can be opened.');
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it.each(['', '.', '..', '../outside', 'nested\\file'])('rejects unsafe file name %j', (name) => {
    expect(validateTempFileName(name)).toBeDefined();
  });
});
