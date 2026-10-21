import * as vscode from 'vscode';
import { spawn } from 'node:child_process';
import { CommandOutput } from '@/host/utils/command-output';
import type {
  WorkflowDefinition,
  WorkflowEnvironmentValues,
  WorkflowRunOutcome,
  WorkflowStep,
  WorkflowStepResult,
} from './protocol';
import { resolveWorkflowPlaceholders } from './placeholders';
import type { SshService } from '@/features/ssh/ssh-service';
import { isWorkflowDefinition } from './service';

export async function validateWorkflow(workflow: WorkflowDefinition, ssh: SshService): Promise<void> {
  if (!isWorkflowDefinition(workflow))
    throw new Error(
      'Invalid workflow. Step names are required, and environment variable names must be unique and use letters, digits, or underscores, starting with a letter or underscore.',
    );
  if (!workflow.steps.length) throw new Error('Add at least one workflow step.');
  const connections = await ssh.listConnections();
  for (const [index, step] of workflow.steps.entries()) {
    if (step.type === 'local-command') {
      if (!step.command.trim()) throw new Error(`Enter the command for step ${index + 1}.`);
    } else {
      if (!connections.some((host) => host.id === step.assetId)) {
        throw new Error(`Select an existing SSH host for step ${index + 1}.`);
      }
      if (step.type === 'ssh-command' && !step.command.trim()) {
        throw new Error(`Enter the SSH command for step ${index + 1}.`);
      }
      if (step.type === 'sftp' && (!step.localPath.trim() || !step.remotePath.trim())) {
        throw new Error(`Enter both file paths for step ${index + 1}.`);
      }
    }
  }
}

export async function runWorkflow(
  workflow: WorkflowDefinition,
  ssh: SshService,
  signal: AbortSignal,
  values: WorkflowEnvironmentValues = {},
  onUpdate?: (outcome: WorkflowRunOutcome) => void,
): Promise<WorkflowRunOutcome> {
  const outputs: string[] = [];
  const steps: WorkflowStepResult[] = workflow.steps.map(() => ({ status: 'pending' }));
  const snapshot = (success: boolean, message: string): WorkflowRunOutcome => ({
    success,
    message,
    output: outputs.join('\n\n'),
    steps: steps.map((step) => ({ ...step })),
  });
  const stop = (index: number, message: string): WorkflowRunOutcome => {
    for (const step of steps.slice(index + 1)) step.status = 'skipped';
    return snapshot(false, `Workflow stopped at step ${index + 1}: ${message}`);
  };
  const environment = { ...process.env, ...values };
  onUpdate?.(snapshot(false, 'Preparing workflow...'));
  for (const [index, step] of workflow.steps.entries()) {
    const current = steps[index]!;
    if (signal.aborted) {
      current.status = 'cancelled';
      return stop(index, 'Task was terminated.');
    }
    current.status = 'running';
    current.startedAt = Date.now();
    const publish = () => onUpdate?.(snapshot(false, `Running step ${index + 1} of ${steps.length}`));
    publish();
    const liveOutput = new CommandOutput();
    let result: WorkflowRunOutcome;
    try {
      result = await runStep(
        step,
        ssh,
        signal,
        environment,
        (data) => {
          liveOutput.append(data);
          current.output = liveOutput.toString();
          publish();
        },
        (transferredBytes, totalBytes) => {
          current.transferredBytes = transferredBytes;
          current.totalBytes = totalBytes;
          publish();
        },
      );
      signal.throwIfAborted();
    } catch (error) {
      const message = signal.aborted ? 'Task was terminated.' : error instanceof Error ? error.message : String(error);
      current.status = signal.aborted ? 'cancelled' : 'failed';
      current.message = message;
      current.finishedAt = Date.now();
      outputs.push([`Step ${index + 1}: ${message}`, current.output].filter(Boolean).join('\n'));
      return stop(index, message);
    }
    current.status = result.success ? 'completed' : 'failed';
    current.message = result.message;
    current.output ??= result.output;
    current.finishedAt = Date.now();
    outputs.push([`Step ${index + 1}: ${result.message}`, result.output].filter(Boolean).join('\n'));
    if (!result.success) {
      return stop(index, result.message);
    }
    publish();
  }

  return snapshot(true, `Workflow completed (${workflow.steps.length} steps).`);
}

async function runStep(
  step: WorkflowStep,
  ssh: SshService,
  signal: AbortSignal,
  environment: NodeJS.ProcessEnv,
  onOutput: (data: Buffer) => void,
  onProgress: (transferredBytes: number, totalBytes: number) => void,
): Promise<WorkflowRunOutcome> {
  if (step.type === 'local-command') {
    const cwd = step.cwd?.trim()
      ? resolveWorkflowPlaceholders(step.cwd.trim(), environment)
      : vscode.workspace.workspaceFolders?.[0]?.uri.fsPath || process.cwd();
    const result = await runLocalCommand(
      resolveWorkflowPlaceholders(step.command, environment),
      cwd,
      signal,
      environment,
      onOutput,
    );
    return {
      success: result.exitCode === 0,
      message: `exited with code ${result.exitCode ?? 'unknown'}.`,
      output: result.output,
    };
  }

  if (step.type === 'sftp') {
    await ssh.transferFile(
      step.assetId,
      step.direction,
      resolveWorkflowPlaceholders(step.localPath, environment),
      resolveWorkflowPlaceholders(step.remotePath, environment),
      signal,
      onProgress,
    );
    return { success: true, message: `SFTP ${step.direction} completed.` };
  }

  const result = await ssh.runLoginCommand(
    step.assetId,
    resolveWorkflowPlaceholders(step.command, environment),
    signal,
    onOutput,
  );
  return {
    success: result.exitCode === 0,
    message: `exited with code ${result.exitCode ?? 'unknown'}.`,
    output: [result.stdout, result.stderr].filter(Boolean).join('\n').trim(),
  };
}

function runLocalCommand(
  command: string,
  cwd: string,
  signal: AbortSignal,
  environment: NodeJS.ProcessEnv,
  onOutput: (data: Buffer) => void,
): Promise<{ exitCode: number | null; output: string }> {
  return new Promise((resolve, reject) => {
    const child = spawn(command, { cwd, shell: true, windowsHide: true, signal, env: environment });
    const output = new CommandOutput();
    const append = (data: Buffer) => {
      output.append(data);
      onOutput(data);
    };
    child.stdout.on('data', append);
    child.stderr.on('data', append);
    child.once('error', reject);
    child.once('close', (exitCode) => resolve({ exitCode, output: output.toString().trim() }));
  });
}
