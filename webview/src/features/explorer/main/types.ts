import type {
	FolderEntry,
	PersistedExplorerState,
} from '../../../../../src/features/explorer/types';

export interface FileEntry extends FolderEntry {
	calculatedSize?: number;
	calculating?: boolean;
	calculationError?: string;
}

export type PersistedState = PersistedExplorerState;

export interface ArchiveOperation {
	id: string;
	kind: 'compress' | 'extract' | 'copy' | 'cut';
	cancelling: boolean;
	percent: number;
	detail: string;
}

export interface ContextMenuState {
	x: number;
	y: number;
	entry: FileEntry | null;
	directoryUri?: string;
}
