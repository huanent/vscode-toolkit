import * as vscode from 'vscode';
import { spawn } from 'node:child_process';
import { CommandOutput } from '@/host/utils/command-output';
import type { WorkflowDefinition, WorkflowEnvironmentValues, WorkflowRunOutcome, WorkflowStep } from './protocol';
import { resolveWorkflowPlaceholders } from './placeholders';
import type { SshService } from '@/features/ssh/ssh-service';
import { isWorkflowDefinition } from './service';

export async function validateWorkflow(workflow: WorkflowDefinition, ssh: SshService): Promise<void> {
  if (!isWorkflowDefinition(workflow))
    throw new Error(
      'Invalid workflow. Environment variable names must be unique and use letters, digits, or underscores, starting with a letter or underscore.',
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
): Promise<WorkflowRunOutcome> {
  const outputs: string[] = [];
  const environment = { ...process.env, ...values };
  for (const [index, step] of workflow.steps.entries()) {
    if (signal.aborted) {
      return {
        success: false,
        message: `Workflow stopped at step ${index + 1}: Task was terminated.`,
        output: outputs.join('\n\n'),
      };
    }
    let result: WorkflowRunOutcome;
    try {
      result = await runStep(step, ssh, signal, environment);
      signal.throwIfAborted();
    } catch (error) {
      const message = signal.aborted ? 'Task was terminated.' : error instanceof Error ? error.message : String(error);
      return {
        success: false,
        message: `Workflow stopped at step ${index + 1}: ${message}`,
        output: outputs.join('\n\n'),
      };
    }
    outputs.push([`Step ${index + 1}: ${result.message}`, result.output].filter(Boolean).join('\n'));
    if (!result.success) {
      return {
        success: false,
        message: `Workflow stopped at step ${index + 1}: ${result.message}`,
        output: outputs.join('\n\n'),
      };
    }
  }

  return {
    success: true,
    message: `Workflow completed (${workflow.steps.length} steps).`,
    output: outputs.join('\n\n'),
  };
}

async function runStep(
  step: WorkflowStep,
  ssh: SshService,
  signal: AbortSignal,
  environment: NodeJS.ProcessEnv,
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
    );
    return {
      success: result.exitCode === 0,
      message: `Local command exited with code ${result.exitCode ?? 'unknown'}.`,
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
    );
    return { success: true, message: `SFTP ${step.direction} completed.` };
  }

  const result = await ssh.runCommand(step.assetId, resolveWorkflowPlaceholders(step.command, environment), signal);
  return {
    success: result.exitCode === 0,
    message: `SSH command exited with code ${result.exitCode ?? 'unknown'}.`,
    output: [result.stdout, result.stderr].filter(Boolean).join('\n').trim(),
  };
}

function runLocalCommand(
  command: string,
  cwd: string,
  signal: AbortSignal,
  environment: NodeJS.ProcessEnv,
): Promise<{ exitCode: number | null; output: string }> {
  return new Promise((resolve, reject) => {
    const child = spawn(command, { cwd, shell: true, windowsHide: true, signal, env: environment });
    const output = new CommandOutput();
    child.stdout.on('data', (data: Buffer) => output.append(data));
    child.stderr.on('data', (data: Buffer) => output.append(data));
    child.once('error', reject);
    child.once('close', (exitCode) => resolve({ exitCode, output: output.toString().trim() }));
  });
}
