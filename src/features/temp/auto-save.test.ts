import { afterEach, describe, expect, it, vi } from 'vitest';
import { createTempAutoSaveScheduler } from './auto-save';
import { TEMP_FILE_SYSTEM_SCHEME } from './protocol';

function createDocument(uriPath: string, scheme = TEMP_FILE_SYSTEM_SCHEME) {
  const save = vi.fn<() => Promise<boolean>>(async () => true);
  const uri = `${scheme}:${uriPath}`;
  return {
    document: {
      uri: { scheme, toString: () => uri },
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
    const scheduler = createTempAutoSaveScheduler();
    const { document, save } = createDocument('/nested/note.md');

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

  it('ignores other schemes and cancels closed documents', () => {
    vi.useFakeTimers();
    const scheduler = createTempAutoSaveScheduler();
    const outsideDocument = createDocument('/note.md', 'file');
    const { document, save } = createDocument('/note.md');

    scheduler.schedule(outsideDocument.document);
    scheduler.schedule(document);
    scheduler.cancel(document);
    vi.advanceTimersByTime(500);

    expect(outsideDocument.save).not.toHaveBeenCalled();
    expect(save).not.toHaveBeenCalled();
    scheduler.dispose();
  });
});
