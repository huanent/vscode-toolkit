import * as vscode from 'vscode';
import { randomUUID } from 'node:crypto';
import { resolveStorageRoots } from '@/host/utils/storage';
import type { StorageScope } from '@/shared/storage-scope';
import type { SshService } from '@/features/ssh/ssh-service';
import type { PlaybookDefinition, PlaybookEnvironmentVariable, PlaybookStep } from './protocol';
import { validatePlaybook } from './runner';
import { readPlaybookRecord, readPlaybookRecords, savePlaybookRecord } from './service';
import type { PlaybookResultService } from './result-service';

interface PlaybookStepInput {
  type: 'local-command' | 'ssh-command' | 'sftp';
  name: string;
  command?: string;
  cwd?: string;
  assetId?: string;
  direction?: 'upload' | 'download';
  localPath?: string;
  remotePath?: string;
}

interface UpsertPlaybookInput {
  id?: string;
  name: string;
  description?: string;
  storageScope?: StorageScope;
  steps: PlaybookStepInput[];
  environment?: PlaybookEnvironmentVariable[];
}

export function registerPlaybookTools(
  context: vscode.ExtensionContext,
  ssh: SshService,
  playbookResults: PlaybookResultService,
  refresh: () => Promise<void>,
): vscode.Disposable[] {
  const getRoots = () => resolveStorageRoots(context, 'playbooks');

  return [
    vscode.lm.registerTool<{ keyword: string }>('playbookSearch', {
      async invoke({ input }, token) {
        const roots = getRoots();
        const entries = await readPlaybookRecords(roots);
        const keyword = input.keyword.toLowerCase();
        const matches = [];
        for (const entry of entries) {
          if (token.isCancellationRequested) throw new Error('Playbook search was cancelled.');
          if (entry.type !== 'playbook') continue;
          const record = await readPlaybookRecord(roots, entry.id);
          if (!record || record.enableAI === false) continue;
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
            stepCount: record.playbook.steps.length,
            stepTypes: record.playbook.steps.map((step) => step.type),
          });
        }
        return jsonResult(matches);
      },
    }),
    vscode.lm.registerTool<{ id: string }>('playbookRun', {
      async prepareInvocation({ input }) {
        const record = await readPlaybookRecord(getRoots(), input.id);
        if (!record) throw new Error('Playbook no longer exists.');
        if (record.enableAI === false) throw new Error('AI tool access is disabled for this playbook.');
        return {
          invocationMessage: `Running playbook ${record.name}`,
          confirmationMessages: {
            title: 'Run playbook?',
            message: `${record.name}\n${record.description ?? ''}\n${JSON.stringify(record.playbook, null, 2)}`,
          },
        };
      },
      async invoke({ input }, token) {
        const record = await readPlaybookRecord(getRoots(), input.id);
        if (!record) throw new Error('Playbook no longer exists.');
        if (record.enableAI === false) throw new Error('AI tool access is disabled for this playbook.');
        if (token.isCancellationRequested) throw new Error('Playbook was cancelled.');
        for (const step of record.playbook.steps) {
          if (step.type !== 'local-command') await ssh.requireAiAccess(step.assetId);
        }
        return jsonResult(await playbookResults.runPlaybookAndWait(record.name, record.playbook, token));
      },
    }),
    vscode.lm.registerTool<UpsertPlaybookInput>('playbookUpsert', {
      async invoke({ input }) {
        if (typeof input.name !== 'string' || !input.name.trim()) {
          throw new Error('Enter a valid playbook name.');
        }
        const roots = getRoots();
        const existing = input.id === undefined ? undefined : await readPlaybookRecord(roots, input.id);
        if (input.id !== undefined && !existing) throw new Error('Playbook no longer exists.');
        const steps = await Promise.all(input.steps.map((step, index) => toPlaybookStep(step, index, ssh)));
        const playbook: PlaybookDefinition = {
          steps,
          environment: input.environment ?? existing?.playbook.environment,
        };
        await validatePlaybook(playbook, ssh);
        const record = await savePlaybookRecord(
          roots,
          existing?.id ?? randomUUID(),
          input.name,
          playbook,
          undefined,
          input.storageScope ?? existing?.scope ?? 'global',
          input.description ?? existing?.description,
          existing?.enableAI !== false,
        );
        await refresh();
        return jsonResult({
          id: record.id,
          name: record.name,
          ...(record.parentId ? { folderId: record.parentId } : {}),
          storageScope: record.scope,
          stepCount: playbook.steps.length,
          action: existing ? 'updated' : 'created',
        });
      },
    }),
  ];
}

async function toPlaybookStep(step: PlaybookStepInput, index: number, ssh: SshService): Promise<PlaybookStep> {
  if (typeof step?.name !== 'string' || !step.name.trim()) {
    throw new Error(`Enter a name for step ${index + 1}.`);
  }
  if (step.type === 'local-command') {
    return {
      type: 'local-command',
      name: step.name.trim(),
      command: step.command ?? '',
      ...(step.cwd ? { cwd: step.cwd } : {}),
    };
  }
  if (step.type === 'sftp') {
    if (!step.direction) throw new Error(`Enter the SFTP direction for step ${index + 1}.`);
    return {
      type: 'sftp',
      name: step.name.trim(),
      assetId: await resolveStepAssetId(step.assetId, ssh),
      direction: step.direction,
      localPath: step.localPath ?? '',
      remotePath: step.remotePath ?? '',
    };
  }
  return {
    type: 'ssh-command',
    name: step.name.trim(),
    assetId: await resolveStepAssetId(step.assetId, ssh),
    command: step.command ?? '',
  };
}

async function resolveStepAssetId(assetId: string | undefined, ssh: SshService): Promise<string> {
  return assetId ? ssh.resolveConnectionId(assetId) : '';
}

function jsonResult(value: unknown): vscode.LanguageModelToolResult {
  return new vscode.LanguageModelToolResult([new vscode.LanguageModelTextPart(JSON.stringify(value))]);
}
