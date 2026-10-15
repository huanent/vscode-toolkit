import * as vscode from 'vscode';
import type { ResultTaskService } from '@/features/result/task-service';
import type { SshService } from '@/features/ssh/ssh-service';
import type { WorkflowDefinition, WorkflowRunOutcome } from './protocol';
import { runWorkflow, validateWorkflow } from './runner';

export class WorkflowResultService {
  constructor(
    private readonly tasks: ResultTaskService,
    private readonly ssh: SshService,
  ) {}

  public async runWorkflow(name: string, workflow: WorkflowDefinition): Promise<void> {
    await this.startWorkflowTask(name, workflow, (signal) => runWorkflow(workflow, this.ssh, signal));
  }

  public async runWorkflowAndWait(
    name: string,
    workflow: WorkflowDefinition,
    cancellation?: vscode.CancellationToken,
  ): Promise<WorkflowRunOutcome> {
    if (cancellation?.isCancellationRequested) throw new Error('Workflow was cancelled.');
    let resolveOutcome!: (outcome: WorkflowRunOutcome) => void;
    let rejectOutcome!: (error: unknown) => void;
    const outcome = new Promise<WorkflowRunOutcome>((resolve, reject) => {
      resolveOutcome = resolve;
      rejectOutcome = reject;
    });
    const taskId = await this.startWorkflowTask(name, workflow, async (signal) => {
      try {
        const result = await runWorkflow(workflow, this.ssh, signal);
        resolveOutcome(result);
        return result;
      } catch (error) {
        rejectOutcome(error);
        throw error;
      }
    });
    const listener = cancellation?.onCancellationRequested(() => void this.tasks.terminateTask(taskId));
    try {
      if (cancellation?.isCancellationRequested) await this.tasks.terminateTask(taskId);
      return await outcome;
    } finally {
      listener?.dispose();
    }
  }

  private async startWorkflowTask(
    name: string,
    workflow: WorkflowDefinition,
    run: (signal: AbortSignal) => Promise<WorkflowRunOutcome>,
  ): Promise<string> {
    await validateWorkflow(workflow, this.ssh);
    await vscode.commands.executeCommand('toolkit.result.focus');
    return this.tasks.startTask<{ name: string; workflow: WorkflowDefinition }, WorkflowRunOutcome>({
      kind: 'workflow',
      title: name,
      input: { name, workflow },
      run,
      getCompletion: (result) =>
        result.success ? { status: 'completed' } : { status: 'failed', error: result.message },
    });
  }
}
