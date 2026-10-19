export interface ArchiveTreeEntry {
  name: string;
  type: 'file' | 'directory';
  size: number;
  children?: ArchiveTreeEntry[];
}

export interface ArchiveChildrenResult {
  type: 'archiveChildren';
  path: string;
  entries?: ArchiveTreeEntry[];
  error?: string;
}
