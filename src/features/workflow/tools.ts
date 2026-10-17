import * as vscode from 'vscode';
import { randomUUID } from 'node:crypto';
import { resolveStorageRoots } from '@/host/utils/storage';
import type { SshService } from '@/features/ssh/ssh-service';
import type { WorkflowDefinition, WorkflowStep } from './protocol';
import { validateWorkflow } from './runner';
import { readWorkflowRecord, saveWorkflowRecord } from './service';

interface WorkflowStepInput {
  type: 'local-command' | 'ssh-command' | 'sftp';
  command?: string;
  cwd?: string;
  assetId?: string;
  direction?: 'upload' | 'download';
  localPath?: string;
  remotePath?: string;
}

interface UpsertWorkflowInput {
  id?: string;
  name: string;
  folderId?: string;
  steps: WorkflowStepInput[];
}

export function registerWorkflowTools(
  context: vscode.ExtensionContext,
  ssh: SshService,
  refresh: () => Promise<void>,
): vscode.Disposable[] {
  const getRoots = () => resolveStorageRoots(context, 'workflows');

  return [
    vscode.lm.registerTool<UpsertWorkflowInput>('workflowUpsert', {
      async invoke({ input }) {
        const roots = getRoots();
        const existing = input.id === undefined ? undefined : await readWorkflowRecord(roots, input.id);
        if (input.id !== undefined && !existing) throw new Error('Workflow no longer exists.');
        const steps = await Promise.all(input.steps.map((step, index) => toWorkflowStep(step, index, ssh)));
        const workflow: WorkflowDefinition = { steps, environment: existing?.workflow.environment };
        await validateWorkflow(workflow, ssh);
        const record = await saveWorkflowRecord(
          roots,
          input.id ?? randomUUID(),
          input.name,
          workflow,
          input.folderId,
          existing?.scope ?? 'global',
          existing?.description,
        );
        await refresh();
        return jsonResult({
          id: record.id,
          name: record.name,
          ...(record.parentId ? { folderId: record.parentId } : {}),
          stepCount: workflow.steps.length,
          action: existing ? 'updated' : 'created',
        });
      },
    }),
  ];
}

async function toWorkflowStep(step: WorkflowStepInput, index: number, ssh: SshService): Promise<WorkflowStep> {
  if (step.type === 'local-command') {
    return { type: 'local-command', command: step.command ?? '', ...(step.cwd ? { cwd: step.cwd } : {}) };
  }
  if (step.type === 'sftp') {
    if (!step.direction) throw new Error(`Enter the SFTP direction for step ${index + 1}.`);
    return {
      type: 'sftp',
      assetId: await resolveStepAssetId(step.assetId, ssh),
      direction: step.direction,
      localPath: step.localPath ?? '',
      remotePath: step.remotePath ?? '',
    };
  }
  return { type: 'ssh-command', assetId: await resolveStepAssetId(step.assetId, ssh), command: step.command ?? '' };
}

async function resolveStepAssetId(assetId: string | undefined, ssh: SshService): Promise<string> {
  return assetId ? ssh.resolveConnectionId(assetId) : '';
}

function jsonResult(value: unknown): vscode.LanguageModelToolResult {
  return new vscode.LanguageModelToolResult([new vscode.LanguageModelTextPart(JSON.stringify(value))]);
}
