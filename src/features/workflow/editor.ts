import * as vscode from 'vscode';
import { registerWebviewEditor } from '@/host/webview-editor';
import { isWorkspaceStorageAvailable } from '@/host/utils/storage';
import { formatTabTitle } from '@/shared/tab-title';
import { isStorageScope, type StorageRoot } from '@/shared/storage-scope';
import type { WorkflowEditorData, WorkflowEditorMessage, WorkflowEditorRequest } from './protocol';
import {
  isWorkflowDefinition,
  readWorkflowRecord,
  saveWorkflowRecord,
  validateWorkflowFolderId,
  validateWorkflowId,
  type StoredWorkflowRecord,
} from './service';
import { validateWorkflow } from './runner';
import type { SshService } from '@/features/ssh/ssh-service';
import type { WorkflowResultService } from './result-service';

export const workflowEditorViewType = 'toolkit.workflowEditor';
export const workflowEditorScheme = 'toolkit-workflow-editor';

export function createWorkflowEditorUri(id: string, name: string, parentId?: string): vscode.Uri {
  validateWorkflowId(id);
  if (parentId) validateWorkflowFolderId(parentId);
  const slug = name.trim().replace(/[^a-zA-Z0-9._-]+/g, '-') || 'workflow';
  return vscode.Uri.from({
    scheme: workflowEditorScheme,
    path: `/${id}/${slug}.workflow`,
    query: parentId ? new URLSearchParams({ parentId }).toString() : '',
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
  getWorkflowRoots: () => StorageRoot[],
  ssh: SshService,
  workflowResults: WorkflowResultService,
  refresh: () => Promise<void>,
): vscode.Disposable {
  const readEditorRecord = async (uri: vscode.Uri): Promise<StoredWorkflowRecord> => {
    const id = parseWorkflowEditorUri(uri);
    const record = await readWorkflowRecord(getWorkflowRoots(), id);
    return (
      record ?? {
        kind: 'workflow',
        id,
        name: 'New Workflow',
        parentId: getWorkflowEditorParentId(uri),
        workflow: { steps: [{ type: 'local-command', command: '' }] },
        scope: 'global',
      }
    );
  };
  return registerWebviewEditor<WorkflowEditorData>(context, {
    viewType: workflowEditorViewType,
    page: 'workflow/editor',
    icon: 'debug-line-by-line',
    validate: parseWorkflowEditorUri,
    load: async (uri) => {
      const { scope, ...initial } = await readEditorRecord(uri);
      return {
        ...initial,
        storageScope: scope,
        workspaceStorageAvailable: isWorkspaceStorageAvailable(),
        sshConnections: await ssh.listConnections(),
      };
    },
    onPanelResolved: (_uri, panel) => {
      void readEditorRecord(_uri)
        .then((record) => {
          panel.title = formatTabTitle(record.name, record.parentId);
        })
        .catch(() => undefined);
      const listener = panel.webview.onDidReceiveMessage(async (message: unknown) => {
        if (!isWorkflowEditorRequest(message)) return;
        try {
          if (message.type === 'saveWorkflow') {
            await validateWorkflow(message.workflow, ssh);
            const id = parseWorkflowEditorUri(_uri);
            await saveWorkflowRecord(
              getWorkflowRoots(),
              id,
              message.name,
              message.workflow,
              getWorkflowEditorParentId(_uri),
              message.storageScope,
            );
            await refresh();
            panel.dispose();
            return;
          }

          await workflowResults.runWorkflow(message.name, message.workflow);
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
  if (parentId) validateWorkflowFolderId(parentId);
  return parentId;
}

function isWorkflowEditorRequest(value: unknown): value is WorkflowEditorRequest {
  if (!value || typeof value !== 'object') return false;
  const request = value as Partial<WorkflowEditorRequest> & { storageScope?: unknown };
  return (
    (request.type === 'saveWorkflow' || request.type === 'runWorkflow') &&
    typeof request.name === 'string' &&
    isWorkflowDefinition(request.workflow) &&
    (request.type === 'runWorkflow' || isStorageScope(request.storageScope))
  );
}
