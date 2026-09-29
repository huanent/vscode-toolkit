import { join, resolve } from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createTempAutoSaveScheduler } from './auto-save';

function createDocument(filePath: string) {
  const save = vi.fn<() => Promise<boolean>>(async () => true);
  return {
    document: {
      uri: { scheme: 'file', fsPath: filePath, toString: () => filePath },
      isDirty: true,
      save,
    },
    save,
  };
}

describe('temporary file auto-save', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('resets the timer on edits and saves after 500 ms of inactivity', () => {
    vi.useFakeTimers();
    const tempDirectory = resolve('storage', 'temp');
    const scheduler = createTempAutoSaveScheduler(tempDirectory);
    const { document, save } = createDocument(join(tempDirectory, 'nested', 'note.md'));

    scheduler.schedule(document);
    vi.advanceTimersByTime(499);
    expect(save).not.toHaveBeenCalled();

    scheduler.schedule(document);
    vi.advanceTimersByTime(499);
    expect(save).not.toHaveBeenCalled();

    vi.advanceTimersByTime(1);
    expect(save).toHaveBeenCalledTimes(1);
    scheduler.dispose();
  });

  it('ignores files outside the temp directory and cancels closed documents', () => {
    vi.useFakeTimers();
    const tempDirectory = resolve('storage', 'temp');
    const scheduler = createTempAutoSaveScheduler(tempDirectory);
    const outsideDocument = createDocument(resolve(tempDirectory, '..', 'temp-other', 'note.md'));
    const { document, save } = createDocument(join(tempDirectory, 'note.md'));

    scheduler.schedule(outsideDocument.document);
    scheduler.schedule(document);
    scheduler.cancel(document);
    vi.advanceTimersByTime(500);

    expect(outsideDocument.save).not.toHaveBeenCalled();
    expect(save).not.toHaveBeenCalled();
    scheduler.dispose();
  });
});
