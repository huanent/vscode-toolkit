import type { ResultTask, ResultTaskSummary, ResultViewState } from './protocol';
import { ResultTaskStore } from './task-store';

export interface ResultTaskDefinition<TInput, TOutput> {
  kind: string;
  title: string;
  input?: TInput;
  run: (signal: AbortSignal, updateOutput: (output: TOutput) => void) => Promise<TOutput>;
  getCompletion?: (output: TOutput) => { status: 'completed' | 'failed'; error?: string };
}

export class ResultTaskService {
  private readonly tasks = new Map<string, ResultTask>();
  private readonly rerunners = new Map<string, (task: ResultTask) => Promise<void>>();
  private readonly controllers = new Map<string, AbortController>();
  private readonly taskOperations = new Map<string, Promise<void>>();
  private store: ResultTaskStore | undefined;
  private initialization: Promise<void> | undefined;
  private readonly listeners = new Set<() => void>();
  private selectedTaskId: string | undefined;
  private disposed = false;
  private hasMore = false;
  private cursor: string | undefined;
  private lastTimestamp = 0;
  private loadingMore: Promise<void> | undefined;

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
    const state: ResultViewState = {
      tasks: tasks.map(toSummary),
      hasMore: this.hasMore,
    };
    if (selectedTask) state.selectedTask = selectedTask;
    return state;
  }

  public getTask(taskId: string): ResultTask | undefined {
    return this.tasks.get(taskId);
  }

  public registerRerunner(kind: string, rerun: (task: ResultTask) => Promise<void>): void {
    this.rerunners.set(kind, rerun);
  }

  public async rerunTask(taskId: string): Promise<void> {
    const task = this.tasks.get(taskId);
    if (!task) throw new Error('Task not found.');
    const rerun = this.rerunners.get(task.kind);
    if (!rerun) throw new Error(`Rerunning ${task.kind} tasks is not supported.`);
    await rerun(task);
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
    await this.getStore();
    while (this.taskOperations.size > 0) await Promise.all(this.taskOperations.values());
    const now = Math.max(Date.now(), this.lastTimestamp + 1);
    this.lastTimestamp = now;
    const task: ResultTask = {
      id: String(now),
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

    await this.publish();
    if (this.disposed) return task.id;
    void this.executeTask(task, definition.run, controller, definition.getCompletion);
    return task.id;
  }

  public async selectTask(taskId: string): Promise<void> {
    const store = await this.getStore();
    if (!this.tasks.has(taskId)) return;
    const current = this.tasks.get(taskId);
    const detail = current?.status === 'running' ? current : await store.read(taskId);
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
      await this.persistTask(store, updatedTask);
    });
    await this.publish();
  }

  public async deleteTask(taskId: string): Promise<void> {
    const store = await this.getStore();
    await this.runTaskOperation(taskId, async () => {
      const task = this.tasks.get(taskId);
      if (!task) return;

      this.controllers.get(taskId)?.abort();
      if (task.status !== 'running') await store.delete(taskId);
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
    await this.loadPage(store);
    this.lastTimestamp = Math.max(0, ...Array.from(this.tasks.values(), (task) => task.createdAt));
    this.selectedTaskId = this.getOrderedTasks()[0]?.id;
    if (this.selectedTaskId) this.tasks.set(this.selectedTaskId, await store.read(this.selectedTaskId));
  }

  public async refreshTasks(): Promise<void> {
    const store = await this.getStore();
    while (this.loadingMore) await this.loadingMore;
    const refresh = async () => {
      for (const [id, task] of this.tasks) {
        if (task.status !== 'running') this.tasks.delete(id);
      }
      this.cursor = undefined;
      this.hasMore = false;
      await this.loadPage(store);
      this.lastTimestamp = Math.max(this.lastTimestamp, ...Array.from(this.tasks.values(), (task) => task.createdAt));
      if (!this.selectedTaskId || !this.tasks.has(this.selectedTaskId)) {
        this.selectedTaskId = this.getOrderedTasks()[0]?.id;
      }
      const selected = this.selectedTaskId ? this.tasks.get(this.selectedTaskId) : undefined;
      if (selected && selected.status !== 'running') {
        const detail = await store.read(selected.id);
        if (this.selectedTaskId === selected.id && this.tasks.get(selected.id) === selected) {
          this.tasks.set(selected.id, detail);
        }
      }
    };
    this.loadingMore = refresh().finally(() => {
      this.loadingMore = undefined;
    });
    await this.loadingMore;
    await this.publish();
  }

  public async loadMoreTasks(): Promise<void> {
    const store = await this.getStore();
    if (!this.hasMore) return;
    this.loadingMore ??= this.loadPage(store).finally(() => {
      this.loadingMore = undefined;
    });
    await this.loadingMore;
    await this.publish();
  }

  private async loadPage(store: ResultTaskStore): Promise<void> {
    const page = await store.list(this.cursor);
    for (const task of page.tasks) {
      if (this.tasks.has(task.id)) continue;
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
    this.cursor = page.tasks.at(-1)?.id ?? this.cursor;
    this.hasMore = page.hasMore;
  }

  private async executeTask<TOutput>(
    task: ResultTask,
    run: ResultTaskDefinition<unknown, TOutput>['run'],
    controller: AbortController,
    getCompletion?: ResultTaskDefinition<unknown, TOutput>['getCompletion'],
  ): Promise<void> {
    let publishTimer: ReturnType<typeof setTimeout> | undefined;
    try {
      const output = await run(controller.signal, (output) => {
        const currentTask = this.tasks.get(task.id);
        if (this.disposed || !currentTask || currentTask.status !== 'running') return;
        this.tasks.set(task.id, { ...currentTask, output, updatedAt: Date.now() });
        publishTimer ??= setTimeout(() => {
          publishTimer = undefined;
          if (!this.disposed) void this.publish();
        }, 80);
      });
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
      clearTimeout(publishTimer);
      this.controllers.delete(task.id);
    }
  }

  private async updateTask(task: ResultTask): Promise<void> {
    if (this.disposed) return;
    const store = await this.getStore();
    await this.runTaskOperation(task.id, async () => {
      const currentTask = this.tasks.get(task.id);
      if (this.disposed || !currentTask || currentTask.status !== 'running') return;
      await this.persistTask(store, task);
    });
    await this.publish();
  }

  private async persistTask(store: ResultTaskStore, task: ResultTask): Promise<void> {
    const saved = await store.create(task, new Set(this.tasks.keys()));
    this.tasks.delete(task.id);
    if (this.selectedTaskId === task.id) this.selectedTaskId = saved.id;
    this.tasks.set(saved.id, this.selectedTaskId === saved.id ? saved : toSummary(saved));
    this.lastTimestamp = Math.max(this.lastTimestamp, Number(saved.id));
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
