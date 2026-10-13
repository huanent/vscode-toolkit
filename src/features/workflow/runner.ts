import * as vscode from 'vscode';
import { spawn } from 'node:child_process';
import type { WorkflowDefinition, WorkflowRunOutcome, WorkflowStep } from './protocol';
import type { SshService } from '@/features/ssh/ssh-service';

export async function validateWorkflow(workflow: WorkflowDefinition, ssh: SshService): Promise<void> {
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
): Promise<WorkflowRunOutcome> {
  const outputs: string[] = [];
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
      result = await runStep(step, ssh, signal);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
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

async function runStep(step: WorkflowStep, ssh: SshService, signal: AbortSignal): Promise<WorkflowRunOutcome> {
  if (step.type === 'local-command') {
    const cwd = step.cwd?.trim() || vscode.workspace.workspaceFolders?.[0]?.uri.fsPath || process.cwd();
    const result = await runLocalCommand(step.command, cwd, signal);
    return {
      success: result.exitCode === 0,
      message: `Local command exited with code ${result.exitCode ?? 'unknown'}.`,
      output: result.output,
    };
  }

  if (step.type === 'sftp') {
    await ssh.transferFile(step.assetId, step.direction, step.localPath, step.remotePath);
    return { success: true, message: `SFTP ${step.direction} completed.` };
  }

  const result = await ssh.runCommand(step.assetId, step.command);
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
): Promise<{ exitCode: number | null; output: string }> {
  return new Promise((resolve, reject) => {
    const child = spawn(command, { cwd, shell: true, windowsHide: true, signal });
    let output = '';
    child.stdout.on('data', (data: Buffer) => (output += data.toString('utf8')));
    child.stderr.on('data', (data: Buffer) => (output += data.toString('utf8')));
    child.once('error', reject);
    child.once('close', (exitCode) => resolve({ exitCode, output: output.trim() }));
  });
}
