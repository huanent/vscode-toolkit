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

export interface WorkflowResult {
    name: string;
    state: 'running' | 'stopping' | 'success' | 'error' | 'cancelled';
    summary: string;
    output: string;
}

export type Result = { type: 'http'; data: HttpResult } | { type: 'table'; data: TableResult } | { type: 'workflow'; data: WorkflowResult };

export interface ResultMessage {
    type: 'result';
    result: Result;
}
