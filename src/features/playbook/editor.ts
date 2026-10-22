import * as vscode from 'vscode';
import { registerWebviewEditor } from '@/host/webview-editor';
import { isWorkspaceStorageAvailable } from '@/host/utils/storage';
import { formatTabTitle } from '@/shared/tab-title';
import { isStorageScope, type StorageRoot } from '@/shared/storage-scope';
import type { PlaybookEditorData, PlaybookEditorMessage, PlaybookEditorRequest } from './protocol';
import {
  isPlaybookDefinition,
  readPlaybookRecord,
  savePlaybookRecord,
  validatePlaybookFolderId,
  validatePlaybookId,
  type StoredPlaybookRecord,
} from './service';
import { validatePlaybook } from './runner';
import type { SshService } from '@/features/ssh/ssh-service';
import type { AssetService } from '@/features/assets/service';
import type { PlaybookResultService } from './result-service';

export const playbookEditorViewType = 'toolkit.playbookEditor';
export const playbookEditorScheme = 'toolkit-playbook-editor';

export function createPlaybookEditorUri(id: string, name: string, parentId?: string): vscode.Uri {
  validatePlaybookId(id);
  if (parentId) validatePlaybookFolderId(parentId);
  const slug = name.trim().replace(/[^a-zA-Z0-9._-]+/g, '-') || 'playbook';
  return vscode.Uri.from({
    scheme: playbookEditorScheme,
    path: `/${id}/${slug}.playbook`,
    query: parentId ? new URLSearchParams({ parentId }).toString() : '',
  });
}

export function parsePlaybookEditorUri(uri: vscode.Uri): string {
  if (uri.scheme !== playbookEditorScheme) throw new Error('Invalid playbook editor URI.');
  const id = uri.path.split('/').filter(Boolean)[0];
  if (!id) throw new Error('Missing playbook id.');
  validatePlaybookId(id);
  return id;
}

export function registerPlaybookEditor(
  context: vscode.ExtensionContext,
  getPlaybookRoots: () => StorageRoot[],
  ssh: SshService,
  assets: AssetService,
  playbookResults: PlaybookResultService,
  refresh: () => Promise<void>,
): vscode.Disposable {
  const readEditorRecord = async (uri: vscode.Uri): Promise<StoredPlaybookRecord> => {
    const id = parsePlaybookEditorUri(uri);
    const record = await readPlaybookRecord(getPlaybookRoots(), id);
    return (
      record ?? {
        kind: 'playbook',
        id,
        name: 'New Playbook',
        parentId: getPlaybookEditorParentId(uri),
        playbook: { steps: [] },
        scope: 'global',
      }
    );
  };
  return registerWebviewEditor<PlaybookEditorData>(context, {
    viewType: playbookEditorViewType,
    page: 'playbook/editor',
    icon: 'run-coverage',
    validate: parsePlaybookEditorUri,
    load: async (uri) => {
      const { scope, ...initial } = await readEditorRecord(uri);
      return {
        ...initial,
        storageScope: scope,
        workspaceStorageAvailable: isWorkspaceStorageAvailable(),
        assets: await assets.listSummaries(),
      };
    },
    onPanelResolved: (_uri, panel) => {
      void readEditorRecord(_uri)
        .then((record) => {
          panel.title = formatTabTitle(record.name, record.parentId);
        })
        .catch(() => undefined);
      const listener = panel.webview.onDidReceiveMessage(async (message: unknown) => {
        if (!isPlaybookEditorRequest(message)) return;
        try {
          if (message.type === 'savePlaybook') {
            await validatePlaybook(message.playbook, ssh);
            const id = parsePlaybookEditorUri(_uri);
            await savePlaybookRecord(
              getPlaybookRoots(),
              id,
              message.name,
              message.playbook,
              getPlaybookEditorParentId(_uri),
              message.storageScope,
              message.description,
              message.enableAI,
            );
            await refresh();
            panel.dispose();
            return;
          }

          await playbookResults.runPlaybook(message.name, message.playbook);
        } catch (error) {
          await panel.webview.postMessage({
            type: 'playbookEditorError',
            message: error instanceof Error ? error.message : String(error),
          } satisfies PlaybookEditorMessage);
        }
      });
      return listener;
    },
  });
}

function getPlaybookEditorParentId(uri: vscode.Uri): string | undefined {
  const parentId = new URLSearchParams(uri.query).get('parentId') ?? undefined;
  if (parentId) validatePlaybookFolderId(parentId);
  return parentId;
}

function isPlaybookEditorRequest(value: unknown): value is PlaybookEditorRequest {
  if (!value || typeof value !== 'object') return false;
  const request = value as Partial<PlaybookEditorRequest> & {
    storageScope?: unknown;
    description?: unknown;
    enableAI?: unknown;
  };
  return (
    (request.type === 'savePlaybook' || request.type === 'runPlaybook') &&
    typeof request.name === 'string' &&
    isPlaybookDefinition(request.playbook) &&
    (request.type === 'runPlaybook' ||
      (isStorageScope(request.storageScope) &&
        typeof request.enableAI === 'boolean' &&
        (request.description === undefined || typeof request.description === 'string')))
  );
}
