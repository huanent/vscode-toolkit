export interface ArchiveTreeEntry {
	name: string;
	type: 'file' | 'directory';
	size: number;
	children?: ArchiveTreeEntry[];
}
