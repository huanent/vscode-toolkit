import * as vscode from 'vscode';
import type { ResultTaskService } from '@/features/result/task-service';
import type { SshService } from '@/features/ssh/ssh-service';
import type {
  PlaybookDefinition,
  PlaybookEnvironmentValues,
  PlaybookEnvironmentVariable,
  PlaybookRunOutcome,
} from './protocol';
import { runPlaybook, validatePlaybook } from './runner';

export class PlaybookResultService {
  constructor(
    private readonly tasks: ResultTaskService,
    private readonly ssh: SshService,
    private readonly requestEnvironment: (
      name: string,
      environment: PlaybookEnvironmentVariable[],
      cancellation?: vscode.CancellationToken,
    ) => Promise<PlaybookEnvironmentValues | undefined>,
  ) {}

  public async runPlaybook(name: string, playbook: PlaybookDefinition): Promise<void> {
    const values = await this.prepareEnvironment(name, playbook);
    if (!values) return;
    await this.startPlaybookTask(name, playbook, (signal, updateOutput) =>
      runPlaybook(playbook, this.ssh, signal, values, updateOutput),
    );
  }

  public async runPlaybookAndWait(
    name: string,
    playbook: PlaybookDefinition,
    cancellation?: vscode.CancellationToken,
  ): Promise<PlaybookRunOutcome> {
    if (cancellation?.isCancellationRequested) throw new Error('Playbook was cancelled.');
    const values = await this.prepareEnvironment(name, playbook, cancellation);
    if (!values || cancellation?.isCancellationRequested) return { success: false, message: 'Playbook was cancelled.' };
    let resolveOutcome!: (outcome: PlaybookRunOutcome) => void;
    let rejectOutcome!: (error: unknown) => void;
    const outcome = new Promise<PlaybookRunOutcome>((resolve, reject) => {
      resolveOutcome = resolve;
      rejectOutcome = reject;
    });
    const taskId = await this.startPlaybookTask(name, playbook, async (signal, updateOutput) => {
      try {
        const result = await runPlaybook(playbook, this.ssh, signal, values, updateOutput);
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
    playbook: PlaybookDefinition,
    cancellation?: vscode.CancellationToken,
  ): Promise<PlaybookEnvironmentValues | undefined> {
    await validatePlaybook(playbook, this.ssh);
    if (!playbook.environment?.length) return {};
    if (cancellation?.isCancellationRequested) return undefined;
    return this.requestEnvironment(name, playbook.environment, cancellation);
  }

  private async startPlaybookTask(
    name: string,
    playbook: PlaybookDefinition,
    run: (signal: AbortSignal, updateOutput: (output: PlaybookRunOutcome) => void) => Promise<PlaybookRunOutcome>,
  ): Promise<string> {
    await vscode.commands.executeCommand('toolkit.results.focus');
    return this.tasks.startTask<{ name: string; playbook: PlaybookDefinition }, PlaybookRunOutcome>({
      kind: 'playbook',
      title: name,
      input: { name, playbook },
      run,
      getCompletion: (result) =>
        result.success ? { status: 'completed' } : { status: 'failed', error: result.message },
    });
  }
}
