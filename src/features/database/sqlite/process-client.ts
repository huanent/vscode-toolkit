import * as path from 'node:path';
import { fork, type ChildProcess } from 'node:child_process';
import type * as engine from './engine';

type Operations = typeof engine;
export type SqliteProcessRequest = {
  [Operation in keyof Operations]: {
    operation: Operation;
    parameters: Parameters<Operations[Operation]>;
  };
}[keyof Operations];

const activeProcesses = new Set<ChildProcess>();

export function disposeSqliteProcesses(): void {
  for (const child of activeProcesses) child.kill('SIGKILL');
  activeProcesses.clear();
}

export function runSqliteOperation<Operation extends keyof Operations>(
  operation: Operation,
  parameters: Parameters<Operations[Operation]>,
  signal?: AbortSignal,
): Promise<ReturnType<Operations[Operation]>> {
  if (signal?.aborted) return Promise.reject(new Error('SQLite operation was cancelled.'));
  return new Promise((resolve, reject) => {
    const child = fork(path.join(__dirname, 'sqlite-process.js'), [], {
      env: { ...process.env, ELECTRON_RUN_AS_NODE: '1' },
      execArgv: [],
      stdio: ['ignore', 'ignore', 'ignore', 'ipc'],
      serialization: 'advanced',
    });
    activeProcesses.add(child);
    let settled = false;
    let failure: Error | undefined;
    let result: ReturnType<Operations[Operation]>;
    const finish = (error?: Error) => {
      if (settled) return;
      settled = true;
      failure = error;
      clearTimeout(timeout);
      signal?.removeEventListener('abort', abort);
      child.kill('SIGKILL');
    };
    const abort = () => finish(new Error('SQLite operation was cancelled.'));
    const timeout = setTimeout(() => finish(new Error('SQLite operation timed out after 60 seconds.')), 60000);
    signal?.addEventListener('abort', abort, { once: true });
    child.once('message', (message: { error?: string; result: ReturnType<Operations[Operation]> }) => {
      result = message.result;
      finish(message.error ? new Error(message.error) : undefined);
    });
    child.once('error', (error) => {
      finish(error);
      reject(error);
    });
    child.once('exit', (code) => {
      if (!settled) finish(new Error(`SQLite process exited before returning a result (${code}).`));
      activeProcesses.delete(child);
      if (failure) reject(failure);
      else resolve(result);
    });
    child.send({ operation, parameters }, (error) => {
      if (error) finish(error);
    });
    if (signal?.aborted) abort();
  });
}