import * as path from 'node:path';

const TEMP_AUTO_SAVE_DELAY_MS = 500;

interface TempAutoSaveDocument {
  uri: {
    scheme: string;
    fsPath: string;
    toString(): string;
  };
  isDirty: boolean;
  save(): PromiseLike<boolean>;
}

export function createTempAutoSaveScheduler(tempDirectory: string) {
  const rootPath = path.resolve(tempDirectory);
  const timers = new Map<string, ReturnType<typeof setTimeout>>();

  function cancel(document: TempAutoSaveDocument): void {
    const timer = timers.get(document.uri.toString());
    if (timer === undefined) return;
    clearTimeout(timer);
    timers.delete(document.uri.toString());
  }

  function schedule(document: TempAutoSaveDocument): void {
    if (document.uri.scheme !== 'file') return;

    const relativePath = path.relative(rootPath, document.uri.fsPath);
    if (
      !relativePath ||
      relativePath === '..' ||
      relativePath.startsWith(`..${path.sep}`) ||
      path.isAbsolute(relativePath)
    ) {
      return;
    }

    cancel(document);
    const documentKey = document.uri.toString();
    const timer = setTimeout(() => {
      timers.delete(documentKey);
      if (document.isDirty) void document.save();
    }, TEMP_AUTO_SAVE_DELAY_MS);
    timers.set(documentKey, timer);
  }

  function dispose(): void {
    for (const timer of timers.values()) clearTimeout(timer);
    timers.clear();
  }

  return { schedule, cancel, dispose };
}
