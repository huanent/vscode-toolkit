export interface HttpResult {
    method: string;
    url: string;
    state: 'loading' | 'success' | 'error' | 'cancelled';
    status?: number;
    statusText?: string;
    elapsed?: number;
    headers?: [string, string][];
    body?: string;
    message?: string;
}

export type TableResult = {
    label?: string;
    source?: string;
    summary: string;
} & (
        | { kind: 'rows'; columns: string[]; rows: Array<Array<string | null>> }
        | { kind: 'command'; message: string }
    );

export interface WorkflowStepResult {
    progress?: { transferred: number; total: number };
    name: string;
    type: 'command' | 'ssh' | 'sftp';
    state: 'pending' | 'running' | 'success' | 'error' | 'cancelled' | 'skipped';
    output: string;
    startedAt?: number;
    finishedAt?: number;
}

export interface WorkflowResult {
    runId: string;
    name: string;
    state: 'running' | 'stopping' | 'success' | 'error' | 'cancelled';
    summary: string;
    output: string;
    steps: WorkflowStepResult[];
    startedAt: number;
    finishedAt?: number;
}

export type Result = { type: 'http'; data: HttpResult } | { type: 'table'; data: TableResult } | { type: 'workflow'; data: WorkflowResult };

export interface ResultMessage {
    type: 'result';
    result: Result;
}

export type TaskState = 'running' | 'stopping' | 'success' | 'error' | 'cancelled';

export interface ResultTask {
    id: string;
    ownerSessionId?: string;
    executionStatus?: 'external' | 'unknown';
    label: string;
    type: Result['type'];
    state: TaskState;
    startedAt: number;
    finishedAt?: number;
    cancellable: boolean;
}

export interface ResultHistoryMessage {
    type: 'history';
    tasks: ResultTask[];
    selectedId?: string;
}
