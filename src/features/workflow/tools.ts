import * as vscode from 'vscode';
import { randomUUID } from 'node:crypto';
import { resolveStorageDirectory } from '@/host/utils/storage';
import type { SshService } from '@/features/ssh/ssh-service';
import type { WorkflowDefinition, WorkflowStep } from './protocol';
import type { WorkflowResultService } from './result-service';
import { validateWorkflow } from './runner';
import { readWorkflowRecord, saveWorkflowRecord } from './service';

interface WorkflowStepInput {
  type: 'local-command' | 'ssh-command' | 'sftp';
  command?: string;
  cwd?: string;
  hostId?: string;
  direction?: 'upload' | 'download';
  localPath?: string;
  remotePath?: string;
}

interface CreateWorkflowInput {
  name: string;
  folderId?: string;
  steps: WorkflowStepInput[];
}

interface RunWorkflowInput {
  id: string;
}

export function registerWorkflowTools(
  context: vscode.ExtensionContext,
  ssh: SshService,
  workflowResults: WorkflowResultService,
  refresh: () => Promise<void>,
): vscode.Disposable[] {
  const getDirectory = () => resolveStorageDirectory(context, 'workflows');

  return [
    vscode.lm.registerTool<CreateWorkflowInput>('workflowCreate', {
      async invoke({ input }) {
        const workflow: WorkflowDefinition = { steps: input.steps.map(toWorkflowStep) };
        await validateWorkflow(workflow, ssh);
        const record = await saveWorkflowRecord(getDirectory(), randomUUID(), input.name, workflow, input.folderId);
        await refresh();
        return jsonResult({
          id: record.id,
          name: record.name,
          ...(record.parentId ? { folderId: record.parentId } : {}),
          stepCount: workflow.steps.length,
        });
      },
    }),
    vscode.lm.registerTool<RunWorkflowInput>('workflowRun', {
      async prepareInvocation({ input }) {
        const record = await readWorkflowRecord(getDirectory(), input.id);
        if (!record) throw new Error('Workflow no longer exists.');
        return {
          invocationMessage: `Running workflow ${record.name}`,
          confirmationMessages: {
            title: 'Run workflow?',
            message: `Workflow: ${record.name}\n${record.workflow.steps.map((step, index) => describeStep(step, index)).join('\n')}`,
          },
        };
      },
      async invoke({ input }, token) {
        const record = await readWorkflowRecord(getDirectory(), input.id);
        if (!record) throw new Error('Workflow no longer exists.');
        return jsonResult(await workflowResults.runWorkflowAndWait(record.name, record.workflow, token));
      },
    }),
  ];
}

function toWorkflowStep(step: WorkflowStepInput, index: number): WorkflowStep {
  if (step.type === 'local-command') {
    return { type: 'local-command', command: step.command ?? '', ...(step.cwd ? { cwd: step.cwd } : {}) };
  }
  if (step.type === 'sftp') {
    if (!step.direction) throw new Error(`Enter the SFTP direction for step ${index + 1}.`);
    return {
      type: 'sftp',
      hostId: step.hostId ?? '',
      direction: step.direction,
      localPath: step.localPath ?? '',
      remotePath: step.remotePath ?? '',
    };
  }
  return { type: 'ssh-command', hostId: step.hostId ?? '', command: step.command ?? '' };
}

function describeStep(step: WorkflowStep, index: number): string {
  const prefix = `${index + 1}.`;
  if (step.type === 'local-command') return `${prefix} Local command: ${step.command}`;
  if (step.type === 'ssh-command') return `${prefix} SSH ${step.hostId}: ${step.command}`;
  return `${prefix} SFTP ${step.direction} ${step.localPath} -> ${step.remotePath} (${step.hostId})`;
}

function jsonResult(value: unknown): vscode.LanguageModelToolResult {
  return new vscode.LanguageModelToolResult([new vscode.LanguageModelTextPart(JSON.stringify(value))]);
}
