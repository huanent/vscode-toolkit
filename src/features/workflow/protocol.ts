import type { StorageScope } from '@/shared/storage-scope';

export type WorkflowStep =
  | { type: 'local-command'; command: string; cwd?: string }
  | { type: 'sftp'; assetId: string; direction: 'upload' | 'download'; localPath: string; remotePath: string }
  | { type: 'ssh-command'; assetId: string; command: string };

export interface WorkflowDefinition {
  steps: WorkflowStep[];
}

export interface WorkflowSshConnection {
  id: string;
  name: string;
  host: string;
  port: number;
}

export interface WorkflowRecord {
  kind: 'workflow';
  id: string;
  name: string;
  parentId?: string;
  workflow: WorkflowDefinition;
}

export interface WorkflowRunOutcome {
  success: boolean;
  message: string;
  output?: string;
}

export interface WorkflowFolderRecord {
  kind: 'folder';
  id: string;
  name: string;
  parentId?: string;
}

export interface WorkflowEditorData extends WorkflowRecord {
  sshConnections: WorkflowSshConnection[];
  storageScope: StorageScope;
  workspaceStorageAvailable: boolean;
}

export type WorkflowEditorRequest =
  | { type: 'saveWorkflow'; name: string; workflow: WorkflowDefinition; storageScope: StorageScope }
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
