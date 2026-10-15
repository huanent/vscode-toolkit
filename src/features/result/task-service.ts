import { randomUUID } from 'node:crypto';
import type { ResultTask, ResultTaskSummary, ResultViewState } from './protocol';
import { ResultTaskStore } from './task-store';

export interface ResultTaskDefinition<TInput, TOutput> {
  kind: string;
  title: string;
  input?: TInput;
  run: (signal: AbortSignal) => Promise<TOutput>;
  getCompletion?: (output: TOutput) => { status: 'completed' | 'failed'; error?: string };
}

export class ResultTaskService {
  private readonly tasks = new Map<string, ResultTask>();
  private readonly controllers = new Map<string, AbortController>();
  private readonly taskOperations = new Map<string, Promise<void>>();
  private store: ResultTaskStore | undefined;
  private initialization: Promise<void> | undefined;
  private readonly listeners = new Set<() => void>();
  private selectedTaskId: string | undefined;
  private disposed = false;

  public dispose(): void {
    this.disposed = true;
    this.listeners.clear();
    for (const controller of this.controllers.values()) controller.abort();
    this.controllers.clear();
  }

  public initialize(directory: string): Promise<void> {
    if (!this.initialization) {
      this.store = new ResultTaskStore(directory);
      this.initialization = this.loadTasks();
    }
    return this.initialization;
  }

  public async getState(): Promise<ResultViewState> {
    await this.getStore();
    const tasks = this.getOrderedTasks();
    const selectedTask = this.selectedTaskId ? this.tasks.get(this.selectedTaskId) : undefined;
    const state: ResultViewState = { tasks: tasks.map(toSummary) };
    if (selectedTask) state.selectedTask = selectedTask;
    return state;
  }

  public getTask(taskId: string): ResultTask | undefined {
    return this.tasks.get(taskId);
  }

  public subscribe(listener: () => void): { dispose(): void } {
    if (this.disposed) throw new Error('Result task service has been disposed.');
    this.listeners.add(listener);
    return {
      dispose: () => {
        this.listeners.delete(listener);
      },
    };
  }

  public async startTask<TInput, TOutput>(definition: ResultTaskDefinition<TInput, TOutput>): Promise<string> {
    const store = await this.getStore();
    const now = Date.now();
    const task: ResultTask = {
      id: randomUUID(),
      kind: definition.kind,
      title: definition.title,
      status: 'running',
      createdAt: now,
      updatedAt: now,
      input: definition.input,
    };
    const controller = new AbortController();
    const previous = this.selectedTaskId ? this.tasks.get(this.selectedTaskId) : undefined;
    if (previous && previous.status !== 'running') this.tasks.set(previous.id, toSummary(previous));
    this.tasks.set(task.id, task);
    this.controllers.set(task.id, controller);
    this.selectedTaskId = task.id;

    try {
      await store.save(task);
    } catch (error) {
      this.tasks.delete(task.id);
      this.controllers.delete(task.id);
      if (this.selectedTaskId === task.id) this.selectedTaskId = this.getOrderedTasks()[0]?.id;
      throw error;
    }
    await this.publish();
    if (this.disposed) return task.id;
    void this.executeTask(task, definition.run, controller, definition.getCompletion);
    return task.id;
  }

  public async selectTask(taskId: string): Promise<void> {
    const store = await this.getStore();
    if (!this.tasks.has(taskId)) return;
    const detail = await store.read(taskId);
    if (!this.tasks.has(taskId)) return;
    const previous = this.selectedTaskId ? this.tasks.get(this.selectedTaskId) : undefined;
    if (previous && previous.status !== 'running') this.tasks.set(previous.id, toSummary(previous));
    if (this.tasks.get(taskId)?.status !== 'running') this.tasks.set(taskId, detail);
    this.selectedTaskId = taskId;
    await this.publish();
  }

  public async terminateTask(taskId: string): Promise<void> {
    const store = await this.getStore();
    await this.runTaskOperation(taskId, async () => {
      const task = this.tasks.get(taskId);
      if (!task || task.status !== 'running') return;

      this.controllers.get(taskId)?.abort();
      const updatedTask: ResultTask = {
        ...task,
        status: 'cancelled',
        error: 'Task was terminated.',
        updatedAt: Date.now(),
      };
      await store.save(updatedTask);
      this.tasks.set(taskId, updatedTask);
    });
    await this.publish();
  }

  public async deleteTask(taskId: string): Promise<void> {
    const store = await this.getStore();
    await this.runTaskOperation(taskId, async () => {
      if (!this.tasks.has(taskId)) return;

      this.controllers.get(taskId)?.abort();
      await store.delete(taskId);
      this.tasks.delete(taskId);
      this.controllers.delete(taskId);
      if (this.selectedTaskId === taskId) {
        this.selectedTaskId = this.getOrderedTasks()[0]?.id;
        if (this.selectedTaskId) await this.selectTask(this.selectedTaskId);
      }
    });
    await this.publish();
  }

  private async loadTasks(): Promise<void> {
    const store = this.store;
    if (!store) throw new Error('Result task storage is not initialized.');

    const tasks = await store.list();
    for (const task of tasks) {
      const recoveredTask: ResultTask =
        task.status === 'running'
          ? {
              ...(await store.read(task.id)),
              status: 'interrupted',
              error: 'Task was interrupted when VS Code closed.',
              updatedAt: Date.now(),
            }
          : task;
      this.tasks.set(recoveredTask.id, toSummary(recoveredTask));
      if (recoveredTask !== task) await store.save(recoveredTask);
    }
    this.selectedTaskId = this.getOrderedTasks()[0]?.id;
    if (this.selectedTaskId) this.tasks.set(this.selectedTaskId, await store.read(this.selectedTaskId));
  }

  private async executeTask<TOutput>(
    task: ResultTask,
    run: (signal: AbortSignal) => Promise<TOutput>,
    controller: AbortController,
    getCompletion?: ResultTaskDefinition<unknown, TOutput>['getCompletion'],
  ): Promise<void> {
    try {
      const output = await run(controller.signal);
      const currentTask = this.tasks.get(task.id);
      if (this.disposed || !currentTask || currentTask.status !== 'running') return;
      const completion = getCompletion?.(output) ?? { status: 'completed' as const };
      await this.updateTask({ ...currentTask, ...completion, output, updatedAt: Date.now() });
    } catch (error) {
      const currentTask = this.tasks.get(task.id);
      if (this.disposed || !currentTask || currentTask.status !== 'running') return;
      await this.updateTask({
        ...currentTask,
        status: controller.signal.aborted ? 'cancelled' : 'failed',
        error: controller.signal.aborted ? 'Task was terminated.' : getErrorMessage(error),
        updatedAt: Date.now(),
      });
    } finally {
      this.controllers.delete(task.id);
    }
  }

  private async updateTask(task: ResultTask): Promise<void> {
    if (this.disposed) return;
    const store = await this.getStore();
    await this.runTaskOperation(task.id, async () => {
      const currentTask = this.tasks.get(task.id);
      if (this.disposed || !currentTask || currentTask.status !== 'running') return;
      await store.save(task);
      this.tasks.set(task.id, this.selectedTaskId === task.id ? task : toSummary(task));
    });
    await this.publish();
  }

  private async runTaskOperation(taskId: string, operation: () => Promise<void>): Promise<void> {
    const previous = this.taskOperations.get(taskId) ?? Promise.resolve();
    let release = (): void => undefined;
    const current = new Promise<void>((resolve) => {
      release = resolve;
    });
    this.taskOperations.set(taskId, current);
    await previous;
    try {
      await operation();
    } finally {
      release();
      if (this.taskOperations.get(taskId) === current) this.taskOperations.delete(taskId);
    }
  }

  private async publish(): Promise<void> {
    for (const listener of this.listeners) listener();
  }

  private async getStore(): Promise<ResultTaskStore> {
    if (this.disposed) throw new Error('Result task service has been disposed.');
    if (!this.initialization) throw new Error('Result task storage has not been initialized.');
    await this.initialization;
    if (this.disposed) throw new Error('Result task service has been disposed.');
    if (!this.store) throw new Error('Result task storage is not initialized.');
    return this.store;
  }

  private getOrderedTasks(): ResultTask[] {
    return [...this.tasks.values()].sort((left, right) => right.createdAt - left.createdAt);
  }
}

function toSummary(task: ResultTask): ResultTaskSummary {
  const { id, kind, title, status, createdAt, updatedAt } = task;
  return { id, kind, title, status, createdAt, updatedAt };
}

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
