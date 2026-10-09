import { WORKFLOW_FILE_SYSTEM_SCHEME } from './protocol';

const WORKFLOW_AUTO_SAVE_DELAY_MS = 500;

interface WorkflowAutoSaveDocument {
  uri: {
    scheme: string;
    toString(): string;
  };
  isDirty: boolean;
  save(): PromiseLike<boolean>;
}

export function createWorkflowAutoSaveScheduler() {
  const timers = new Map<string, ReturnType<typeof setTimeout>>();

  function cancel(document: WorkflowAutoSaveDocument): void {
    const timer = timers.get(document.uri.toString());
    if (timer === undefined) return;
    clearTimeout(timer);
    timers.delete(document.uri.toString());
  }

  function schedule(document: WorkflowAutoSaveDocument): void {
    if (document.uri.scheme !== WORKFLOW_FILE_SYSTEM_SCHEME) return;

    cancel(document);
    const documentKey = document.uri.toString();
    const timer = setTimeout(() => {
      timers.delete(documentKey);
      if (document.isDirty) void document.save();
    }, WORKFLOW_AUTO_SAVE_DELAY_MS);
    timers.set(documentKey, timer);
  }

  function dispose(): void {
    for (const timer of timers.values()) clearTimeout(timer);
    timers.clear();
  }

  return { schedule, cancel, dispose };
}
