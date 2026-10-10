import * as vscode from 'vscode';
import { spawn } from 'node:child_process';
import { registerWebviewEditor } from '@/host/webview-editor';
import type { WorkflowEditorData, WorkflowEditorMessage, WorkflowEditorRequest, WorkflowRecord } from './protocol';
import { isWorkflowDefinition, readWorkflowRecord, saveWorkflowRecord, validateWorkflowId } from './service';
import type { SshService } from '@/features/ssh/ssh-service';

export const workflowEditorViewType = 'toolkit.workflowEditor';
export const workflowEditorScheme = 'toolkit-workflow-editor';

export function createWorkflowEditorUri(id: string, name: string, parentId?: string): vscode.Uri {
  validateWorkflowId(id);
  if (parentId) validateWorkflowId(parentId);
  const slug = name.trim().replace(/[^a-zA-Z0-9._-]+/g, '-') || 'workflow';
  return vscode.Uri.from({
    scheme: workflowEditorScheme,
    path: `/${id}/${slug}.workflow`,
    query: parentId ? `parentId=${parentId}` : '',
  });
}

export function parseWorkflowEditorUri(uri: vscode.Uri): string {
  if (uri.scheme !== workflowEditorScheme) throw new Error('Invalid workflow editor URI.');
  const id = uri.path.split('/').filter(Boolean)[0];
  if (!id) throw new Error('Missing workflow id.');
  validateWorkflowId(id);
  return id;
}

export function registerWorkflowEditor(
  context: vscode.ExtensionContext,
  getWorkflowDirectory: () => string,
  ssh: SshService,
  refresh: () => Promise<void>,
): vscode.Disposable {
  const outputChannel = vscode.window.createOutputChannel('Toolkit Workflow');
  context.subscriptions.push(outputChannel);

  return registerWebviewEditor<WorkflowEditorData>(context, {
    viewType: workflowEditorViewType,
    page: 'workflow-editor',
    icon: 'debug-line-by-line',
    validate: parseWorkflowEditorUri,
    load: async (uri) => {
      const id = parseWorkflowEditorUri(uri);
      const record = await readWorkflowRecord(getWorkflowDirectory(), id);
      const initial: WorkflowRecord = record ?? {
        kind: 'workflow',
        id,
        name: 'New Workflow',
        parentId: getWorkflowEditorParentId(uri),
        workflow: { steps: [{ type: 'local-command', command: '' }] },
      };
      return { ...initial, sshConnections: await ssh.listConnections() };
    },
    onPanelResolved: (_uri, panel) => {
      const listener = panel.webview.onDidReceiveMessage(async (message: unknown) => {
        if (!isWorkflowEditorRequest(message)) return;
        try {
          await validateWorkflow(message.workflow, ssh);
          if (message.type === 'saveWorkflow') {
            const id = parseWorkflowEditorUri(_uri);
            const record = await saveWorkflowRecord(
              getWorkflowDirectory(),
              id,
              message.name,
              message.workflow,
              getWorkflowEditorParentId(_uri),
            );
            panel.title = record.name;
            await refresh();
            await panel.webview.postMessage({
              type: 'workflowSaved',
              name: record.name,
            } satisfies WorkflowEditorMessage);
            return;
          }

          const result = await runWorkflow(message.name, message.workflow, ssh, outputChannel);
          await panel.webview.postMessage({ type: 'workflowRunResult', ...result } satisfies WorkflowEditorMessage);
        } catch (error) {
          await panel.webview.postMessage({
            type: 'workflowEditorError',
            message: error instanceof Error ? error.message : String(error),
          } satisfies WorkflowEditorMessage);
        }
      });
      return listener;
    },
  });
}

function getWorkflowEditorParentId(uri: vscode.Uri): string | undefined {
  const parentId = new URLSearchParams(uri.query).get('parentId') ?? undefined;
  if (parentId) validateWorkflowId(parentId);
  return parentId;
}

function isWorkflowEditorRequest(value: unknown): value is WorkflowEditorRequest {
  if (!value || typeof value !== 'object') return false;
  const request = value as Partial<WorkflowEditorRequest>;
  return (
    (request.type === 'saveWorkflow' || request.type === 'runWorkflow') &&
    typeof request.name === 'string' &&
    isWorkflowDefinition(request.workflow)
  );
}

async function validateWorkflow(workflow: WorkflowEditorRequest['workflow'], ssh: SshService): Promise<void> {
  if (!workflow.steps.length) throw new Error('Add at least one workflow step.');
  const connections = await ssh.listConnections();
  for (const [index, step] of workflow.steps.entries()) {
    if (step.type === 'local-command') {
      if (!step.command.trim()) throw new Error(`Enter the command for step ${index + 1}.`);
    } else {
      if (!connections.some((host) => host.id === step.hostId)) {
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

async function runWorkflow(
  name: string,
  workflow: WorkflowEditorRequest['workflow'],
  ssh: SshService,
  outputChannel: vscode.OutputChannel,
): Promise<{ success: boolean; message: string; output?: string }> {
  const outputs: string[] = [];
  outputChannel.appendLine(`Workflow: ${name}`);
  for (const [index, step] of workflow.steps.entries()) {
    let result: { success: boolean; message: string; output?: string };
    try {
      result = await runStep(step, ssh);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      outputChannel.appendLine(`Step ${index + 1} failed: ${message}`);
      outputChannel.show(true);
      return {
        success: false,
        message: `Workflow stopped at step ${index + 1}: ${message}`,
        output: outputs.join('\n\n'),
      };
    }
    outputChannel.appendLine(`Step ${index + 1}: ${result.message}`);
    if (result.output) {
      outputs.push(`Step ${index + 1}\n${result.output}`);
      outputChannel.appendLine(result.output);
    }
    if (!result.success) {
      outputChannel.show(true);
      return {
        success: false,
        message: `Workflow stopped at step ${index + 1}: ${result.message}`,
        output: outputs.join('\n\n'),
      };
    }
  }

  outputChannel.show(true);
  return {
    success: true,
    message: `Workflow completed (${workflow.steps.length} steps).`,
    output: outputs.join('\n\n'),
  };
}

async function runStep(
  step: WorkflowEditorRequest['workflow']['steps'][number],
  ssh: SshService,
): Promise<{ success: boolean; message: string; output?: string }> {
  if (step.type === 'local-command') {
    const cwd = step.cwd?.trim() || vscode.workspace.workspaceFolders?.[0]?.uri.fsPath || process.cwd();
    const result = await runLocalCommand(step.command, cwd);
    return {
      success: result.exitCode === 0,
      message: `Local command exited with code ${result.exitCode ?? 'unknown'}.`,
      output: result.output,
    };
  }

  if (step.type === 'sftp') {
    await ssh.transferFile(step.hostId, step.direction, step.localPath, step.remotePath);
    return { success: true, message: `SFTP ${step.direction} completed.` };
  }

  const result = await ssh.runCommand(step.hostId, step.command);
  return {
    success: result.exitCode === 0,
    message: `SSH command exited with code ${result.exitCode ?? 'unknown'}.`,
    output: [result.stdout, result.stderr].filter(Boolean).join('\n').trim(),
  };
}

function runLocalCommand(command: string, cwd: string): Promise<{ exitCode: number | null; output: string }> {
  return new Promise((resolve, reject) => {
    const child = spawn(command, { cwd, shell: true, windowsHide: true });
    let output = '';
    child.stdout.on('data', (data: Buffer) => (output += data.toString('utf8')));
    child.stderr.on('data', (data: Buffer) => (output += data.toString('utf8')));
    child.once('error', reject);
    child.once('close', (exitCode) => resolve({ exitCode, output: output.trim() }));
  });
}
