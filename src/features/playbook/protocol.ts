import type { StorageScope } from '@/shared/storage-scope';
import type { AssetSummary } from '@/features/assets/protocol';

export type PlaybookStep =
  | { type: 'local-command'; name: string; command: string; cwd?: string }
  | {
      type: 'sftp';
      name: string;
      assetId: string;
      direction: 'upload' | 'download';
      localPath: string;
      remotePath: string;
    }
  | { type: 'ssh-command'; name: string; assetId: string; command: string };

export type PlaybookEnvironmentVariable =
  | { name: string; label: string; type: 'input'; defaultValue: string }
  | { name: string; label: string; type: 'checkbox'; defaultValue: boolean }
  | { name: string; label: string; type: 'select'; defaultValue: string; options: { value: string; label: string }[] };

export type PlaybookEnvironmentValues = Record<string, string>;

export interface PlaybookRunFormData {
  name: string;
  environment: PlaybookEnvironmentVariable[];
}

export type PlaybookRunFormRequest =
  | { type: 'submitPlaybookRun'; values: PlaybookEnvironmentValues }
  | { type: 'cancelPlaybookRun' };

export interface PlaybookDefinition {
  steps: PlaybookStep[];
  environment?: PlaybookEnvironmentVariable[];
}

export interface PlaybookRecord {
  kind: 'playbook';
  id: string;
  name: string;
  description?: string;
  enableAI?: boolean;
  parentId?: string;
  playbook: PlaybookDefinition;
}

export interface PlaybookStepResult {
  status: 'pending' | 'running' | 'completed' | 'failed' | 'cancelled' | 'skipped';
  output?: string;
  message?: string;
  startedAt?: number;
  finishedAt?: number;
  transferredBytes?: number;
  totalBytes?: number;
}

export interface PlaybookRunOutcome {
  success: boolean;
  message: string;
  output?: string;
  steps?: PlaybookStepResult[];
}

export interface PlaybookFolderRecord {
  kind: 'folder';
  id: string;
  name: string;
  parentId?: string;
}

export interface PlaybookEditorData extends PlaybookRecord {
  assets: AssetSummary[];
  storageScope: StorageScope;
  workspaceStorageAvailable: boolean;
}

export type PlaybookEditorRequest =
  | {
      type: 'savePlaybook';
      name: string;
      description?: string;
      playbook: PlaybookDefinition;
      storageScope: StorageScope;
      enableAI: boolean;
    }
  | { type: 'runPlaybook'; name: string; playbook: PlaybookDefinition };

export type PlaybookEditorMessage =
  | { type: 'playbookSaved'; name: string }
  | { type: 'playbookEditorError'; message: string };

export interface PlaybookEditorOpenRequest {
  type: 'openPlaybookEditor';
  id?: string;
  parentId?: string;
}

export interface PlaybookRunRequest {
  type: 'runPlaybookFile';
  id: string;
}

export interface PlaybookRecordEntry {
  id: string;
  name: string;
  type: 'playbook' | 'folder';
  parentId?: string;
}

export type PlaybookFilesWebviewMessage =
  | { type: 'playbookFilesUpdated'; entries: PlaybookRecordEntry[] }
  | { type: 'playbookFileError'; message: string };
