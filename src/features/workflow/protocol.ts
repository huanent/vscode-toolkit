import type { StorageScope } from '@/shared/storage-scope';
import type { AssetSummary } from '@/features/assets/protocol';

export type WorkflowStep =
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

export type WorkflowEnvironmentVariable =
  | { name: string; label: string; type: 'input'; defaultValue: string }
  | { name: string; label: string; type: 'checkbox'; defaultValue: boolean }
  | { name: string; label: string; type: 'select'; defaultValue: string; options: { value: string; label: string }[] };

export type WorkflowEnvironmentValues = Record<string, string>;

export interface WorkflowRunFormData {
  name: string;
  environment: WorkflowEnvironmentVariable[];
}

export type WorkflowRunFormRequest =
  | { type: 'submitWorkflowRun'; values: WorkflowEnvironmentValues }
  | { type: 'cancelWorkflowRun' };

export interface WorkflowDefinition {
  steps: WorkflowStep[];
  environment?: WorkflowEnvironmentVariable[];
}

export interface WorkflowRecord {
  kind: 'workflow';
  id: string;
  name: string;
  description?: string;
  enableAI?: boolean;
  parentId?: string;
  workflow: WorkflowDefinition;
}

export interface WorkflowStepResult {
  status: 'pending' | 'running' | 'completed' | 'failed' | 'cancelled' | 'skipped';
  output?: string;
  message?: string;
  startedAt?: number;
  finishedAt?: number;
  transferredBytes?: number;
  totalBytes?: number;
}

export interface WorkflowRunOutcome {
  success: boolean;
  message: string;
  output?: string;
  steps?: WorkflowStepResult[];
}

export interface WorkflowFolderRecord {
  kind: 'folder';
  id: string;
  name: string;
  parentId?: string;
}

export interface WorkflowEditorData extends WorkflowRecord {
  assets: AssetSummary[];
  storageScope: StorageScope;
  workspaceStorageAvailable: boolean;
}

export type WorkflowEditorRequest =
  | {
      type: 'saveWorkflow';
      name: string;
      description?: string;
      workflow: WorkflowDefinition;
      storageScope: StorageScope;
      enableAI: boolean;
    }
  | { type: 'runWorkflow'; name: string; workflow: WorkflowDefinition };

export type WorkflowEditorMessage =
  | { type: 'workflowSaved'; name: string }
  | { type: 'workflowEditorError'; message: string };

export interface WorkflowEditorOpenRequest {
  type: 'openWorkflowEditor';
  id?: string;
  parentId?: string;
}

export interface WorkflowRunRequest {
  type: 'runWorkflowFile';
  id: string;
}

export interface WorkflowRecordEntry {
  id: string;
  name: string;
  type: 'workflow' | 'folder';
  parentId?: string;
}

export type WorkflowFilesWebviewMessage =
  | { type: 'workflowFilesUpdated'; entries: WorkflowRecordEntry[] }
  | { type: 'workflowFileError'; message: string };
