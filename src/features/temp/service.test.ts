import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  createTempDirectory,
  createTempFile,
  deleteTempEntry,
  getTempFilePath,
  readTempTree,
  resolveTempFileSystemPath,
  renameTempEntry,
  resolveTempDirectory,
  validateTempFileName,
  validateTempFolderName,
} from './service';

describe('temporary file service', () => {
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

  it('creates folders without replacing existing folders', async () => {
    const root = await mkdtemp(join(tmpdir(), 'toolkit-temp-test-'));
    const directory = join(root, 'temp');
    try {
      const directoryPath = await createTempDirectory(directory, 'drafts');
      expect(await readTempTree(directory)).toEqual([{ name: 'drafts', type: 'directory', children: [] }]);
      await expect(createTempDirectory(directory, 'drafts')).rejects.toMatchObject({ code: 'EEXIST' });
      expect(directoryPath).toBe(join(directory, 'drafts'));
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it('only resolves folders inside the temp directory', async () => {
    const root = await mkdtemp(join(tmpdir(), 'toolkit-temp-test-'));
    const directory = join(root, 'temp');
    try {
      await mkdir(join(directory, 'folder', 'nested'), { recursive: true });
      await writeFile(join(directory, 'note.md'), '');
      expect(await resolveTempDirectory(directory, 'folder/nested')).toBe(join(directory, 'folder', 'nested'));
      await expect(resolveTempDirectory(directory, 'folder/../..')).rejects.toThrow('Invalid temporary path.');
      await expect(resolveTempDirectory(directory, 'note.md')).rejects.toThrow(
        'Only temporary folders can hold new items.',
      );
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
      await expect(getTempFilePath(directory, '../outside.txt')).rejects.toThrow('Invalid temporary path.');
      await mkdir(join(directory, 'folder'));
      await expect(getTempFilePath(directory, 'folder')).rejects.toThrow('Only regular temporary files can be opened.');
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it('maps virtual filesystem paths inside the temp directory', () => {
    const directory = join('/storage', 'temp');
    expect(resolveTempFileSystemPath(directory, '/folder/note.md')).toBe(join(directory, 'folder', 'note.md'));
    expect(resolveTempFileSystemPath(directory, '/')).toBe(directory);
    expect(() => resolveTempFileSystemPath(directory, '/../../outside.txt')).toThrow('Invalid temporary path.');
    expect(() => resolveTempFileSystemPath(directory, '/folder\\..\\outside.txt')).toThrow('Invalid temporary path.');
    expect(() => resolveTempFileSystemPath(directory, 'folder/note.md')).toThrow('Invalid temporary path.');
  });

  it.each(['', '.', '..', '../outside', 'nested\\file'])('rejects unsafe file name %j', (name) => {
    expect(validateTempFileName(name)).toBeDefined();
  });

  it.each(['', '.', '..', '../outside', 'nested\\folder'])('rejects unsafe folder name %j', (name) => {
    expect(validateTempFolderName(name)).toBeDefined();
  });

  it('deletes files and folders inside the temp directory', async () => {
    const root = await mkdtemp(join(tmpdir(), 'toolkit-temp-test-'));
    const directory = join(root, 'temp');
    try {
      await mkdir(join(directory, 'folder'), { recursive: true });
      await writeFile(join(directory, 'folder', 'draft.txt'), 'draft');
      await writeFile(join(directory, 'note.md'), '');

      expect(await deleteTempEntry(directory, 'note.md')).toBe(join(directory, 'note.md'));
      expect(await deleteTempEntry(directory, 'folder')).toBe(join(directory, 'folder'));
      expect(await readTempTree(directory)).toEqual([]);
      await expect(deleteTempEntry(directory, '../outside.txt')).rejects.toThrow('Invalid temporary path.');
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it('renames entries in place without replacing existing ones', async () => {
    const root = await mkdtemp(join(tmpdir(), 'toolkit-temp-test-'));
    const directory = join(root, 'temp');
    try {
      await mkdir(join(directory, 'folder'), { recursive: true });
      await writeFile(join(directory, 'other.md'), '');
      await writeFile(join(directory, 'note.md'), '');

      expect(await renameTempEntry(directory, 'folder', 'drafts')).toBe(join(directory, 'drafts'));
      expect(await renameTempEntry(directory, 'note.md', 'renamed.md')).toBe(join(directory, 'renamed.md'));
      expect(await renameTempEntry(directory, 'renamed.md', 'renamed.md')).toBe(join(directory, 'renamed.md'));
      await expect(renameTempEntry(directory, 'renamed.md', 'other.md')).rejects.toThrow('"other.md" already exists.');
      await expect(renameTempEntry(directory, 'renamed.md', 'nested/name.md')).rejects.toThrow(
        'Enter a file name without a path.',
      );
      expect(await readTempTree(directory)).toEqual([
        { name: 'drafts', type: 'directory', children: [] },
        { name: 'other.md', type: 'file' },
        { name: 'renamed.md', type: 'file' },
      ]);
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });
});
