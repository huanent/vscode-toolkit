import * as vscode from 'vscode';
import type { ResultTaskService } from '@/features/result/task-service';
import type { SshService } from '@/features/ssh/ssh-service';
import type {
  WorkflowDefinition,
  WorkflowEnvironmentValues,
  WorkflowEnvironmentVariable,
  WorkflowRunOutcome,
} from './protocol';
import { runWorkflow, validateWorkflow } from './runner';

export class WorkflowResultService {
  constructor(
    private readonly tasks: ResultTaskService,
    private readonly ssh: SshService,
    private readonly requestEnvironment: (
      name: string,
      environment: WorkflowEnvironmentVariable[],
      cancellation?: vscode.CancellationToken,
    ) => Promise<WorkflowEnvironmentValues | undefined>,
  ) {}

  public async runWorkflow(name: string, workflow: WorkflowDefinition): Promise<void> {
    const values = await this.prepareEnvironment(name, workflow);
    if (!values) return;
    await this.startWorkflowTask(name, workflow, (signal, updateOutput) =>
      runWorkflow(workflow, this.ssh, signal, values, updateOutput),
    );
  }

  public async runWorkflowAndWait(
    name: string,
    workflow: WorkflowDefinition,
    cancellation?: vscode.CancellationToken,
  ): Promise<WorkflowRunOutcome> {
    if (cancellation?.isCancellationRequested) throw new Error('Workflow was cancelled.');
    const values = await this.prepareEnvironment(name, workflow, cancellation);
    if (!values || cancellation?.isCancellationRequested) return { success: false, message: 'Workflow was cancelled.' };
    let resolveOutcome!: (outcome: WorkflowRunOutcome) => void;
    let rejectOutcome!: (error: unknown) => void;
    const outcome = new Promise<WorkflowRunOutcome>((resolve, reject) => {
      resolveOutcome = resolve;
      rejectOutcome = reject;
    });
    const taskId = await this.startWorkflowTask(name, workflow, async (signal, updateOutput) => {
      try {
        const result = await runWorkflow(workflow, this.ssh, signal, values, updateOutput);
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

  private async prepareEnvironment(
    name: string,
    workflow: WorkflowDefinition,
    cancellation?: vscode.CancellationToken,
  ): Promise<WorkflowEnvironmentValues | undefined> {
    await validateWorkflow(workflow, this.ssh);
    if (!workflow.environment?.length) return {};
    if (cancellation?.isCancellationRequested) return undefined;
    return this.requestEnvironment(name, workflow.environment, cancellation);
  }

  private async startWorkflowTask(
    name: string,
    workflow: WorkflowDefinition,
    run: (signal: AbortSignal, updateOutput: (output: WorkflowRunOutcome) => void) => Promise<WorkflowRunOutcome>,
  ): Promise<string> {
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
