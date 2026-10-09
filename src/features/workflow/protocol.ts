export const WORKFLOW_FILE_SYSTEM_SCHEME = 'toolkit-workflow';

export type WorkflowEntryType = 'file' | 'directory';

export interface WorkflowTreeEntry {
  name: string;
  type: WorkflowEntryType;
  children?: WorkflowTreeEntry[];
}

/**
 * `data-vscode-context` payload of a right-clicked workflow entry. It is also the
 * argument passed to the workflow `webview/context` menu commands.
 */
export interface WorkflowContextTarget {
  /** Slash-separated path relative to the workflow directory. */
  workflowEntryPath?: string;
  workflowEntryType?: WorkflowEntryType;
}

export interface OpenWorkflowFileRequest {
  type: 'openWorkflowFile';
  path: string;
}

export type WorkflowFilesWebviewMessage =
  | { type: 'workflowFilesUpdated'; entries: WorkflowTreeEntry[] }
  | { type: 'workflowFileError'; message: string };
