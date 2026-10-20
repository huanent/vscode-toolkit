import * as vscode from 'vscode';
import { randomUUID } from 'node:crypto';
import { resolveStorageRoots } from '@/host/utils/storage';
import type { StorageScope } from '@/shared/storage-scope';
import type { SshService } from '@/features/ssh/ssh-service';
import type { WorkflowDefinition, WorkflowEnvironmentVariable, WorkflowStep } from './protocol';
import { validateWorkflow } from './runner';
import { readWorkflowRecord, readWorkflowRecords, saveWorkflowRecord } from './service';
import type { WorkflowResultService } from './result-service';

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
  description?: string;
  folderId?: string;
  storageScope?: StorageScope;
  steps: WorkflowStepInput[];
  environment?: WorkflowEnvironmentVariable[];
}

export function registerWorkflowTools(
  context: vscode.ExtensionContext,
  ssh: SshService,
  workflowResults: WorkflowResultService,
  refresh: () => Promise<void>,
): vscode.Disposable[] {
  const getRoots = () => resolveStorageRoots(context, 'workflows');

  return [
    vscode.lm.registerTool<{ keyword: string }>('workflowSearch', {
      async invoke({ input }, token) {
        const roots = getRoots();
        const entries = await readWorkflowRecords(roots);
        const keyword = input.keyword.toLowerCase();
        const matches = [];
        for (const entry of entries) {
          if (token.isCancellationRequested) throw new Error('Workflow search was cancelled.');
          if (entry.type !== 'workflow') continue;
          const record = await readWorkflowRecord(roots, entry.id);
          if (!record) continue;
          if (
            ![record.id, record.name, record.description ?? '', record.parentId ?? ''].some((value) =>
              value.toLowerCase().includes(keyword),
            )
          )
            continue;
          matches.push({
            id: record.id,
            name: record.name,
            description: record.description,
            folderId: record.parentId,
            storageScope: record.scope,
            stepCount: record.workflow.steps.length,
            stepTypes: record.workflow.steps.map((step) => step.type),
          });
        }
        return jsonResult(matches);
      },
    }),
    vscode.lm.registerTool<{ id: string }>('workflowRun', {
      async prepareInvocation({ input }) {
        const record = await readWorkflowRecord(getRoots(), input.id);
        if (!record) throw new Error('Workflow no longer exists.');
        return {
          invocationMessage: `Running workflow ${record.name}`,
          confirmationMessages: {
            title: 'Run workflow?',
            message: `${record.name}\n${record.description ?? ''}\n${JSON.stringify(record.workflow, null, 2)}`,
          },
        };
      },
      async invoke({ input }, token) {
        const record = await readWorkflowRecord(getRoots(), input.id);
        if (!record) throw new Error('Workflow no longer exists.');
        if (token.isCancellationRequested) throw new Error('Workflow was cancelled.');
        for (const step of record.workflow.steps) {
          if (step.type !== 'local-command') await ssh.requireAiAccess(step.assetId);
        }
        return jsonResult(await workflowResults.runWorkflowAndWait(record.name, record.workflow, token));
      },
    }),
    vscode.lm.registerTool<UpsertWorkflowInput>('workflowUpsert', {
      async invoke({ input }) {
        const roots = getRoots();
        const existing = input.id === undefined ? undefined : await readWorkflowRecord(roots, input.id);
        if (input.id !== undefined && !existing) throw new Error('Workflow no longer exists.');
        const steps = await Promise.all(input.steps.map((step, index) => toWorkflowStep(step, index, ssh)));
        const workflow: WorkflowDefinition = {
          steps,
          environment: input.environment ?? existing?.workflow.environment,
        };
        await validateWorkflow(workflow, ssh);
        const record = await saveWorkflowRecord(
          roots,
          existing?.id ?? randomUUID(),
          input.name,
          workflow,
          input.folderId,
          input.storageScope ?? existing?.scope ?? 'global',
          input.description ?? existing?.description,
        );
        await refresh();
        return jsonResult({
          id: record.id,
          name: record.name,
          ...(record.parentId ? { folderId: record.parentId } : {}),
          storageScope: record.scope,
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
