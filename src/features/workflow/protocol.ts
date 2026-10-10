export const sftpActions = ['upload', 'download'] as const;
export type SftpAction = typeof sftpActions[number];

export type WorkflowStep =
    | { name: string; type: 'command'; command: string; cwd: string }
    | { name: string; type: 'ssh'; serverId: string; command: string }
    | { name: string; type: 'sftp'; serverId: string; action?: SftpAction; localPath: string; remotePath: string };

export interface Workflow {
    id: string;
    name: string;
    description?: string;
    steps: WorkflowStep[];
}