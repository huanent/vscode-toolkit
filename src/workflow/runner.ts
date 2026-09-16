import { executeLocalCommand } from './localCommand';
import * as vscode from 'vscode';
import type { Result, WorkflowResult } from '../result/protocol';
import type { ResultView } from '../result/resultView';
import { resolveSshConnection } from '../ssh/connectionService';
import { executeSshCommand } from '../ssh/sshCommand';
import { downloadSftpFile, writeSftpFile } from '../ssh/sftp';
import { executeWorkflow, type Workflow } from './workflow';

export class WorkflowExecutionError extends Error { }

export class WorkflowRunner implements vscode.Disposable {
    private readonly command = vscode.commands.registerCommand('vscode-toolkit.cancelWorkflow', () => this.cancellation?.cancel());
    private cancellation: vscode.CancellationTokenSource | undefined;
    private result: Result | undefined;

    constructor(private readonly resultView: ResultView) { }

    showOutput(): void {
        if (this.result) void this.resultView.show(this.result);
        else void vscode.commands.executeCommand('vscode-toolkit.result.focus');
    }

    async run(workflow: Workflow, toolToken?: vscode.CancellationToken): Promise<boolean> {
        const cancellation = new vscode.CancellationTokenSource();
        const abortController = new AbortController();
        this.cancellation = cancellation;
        const data: WorkflowResult = { name: workflow.name, state: 'running', summary: 'Starting...', output: '' };
        const result: Result = { type: 'workflow', data };
        this.result = result;
        let updateTimer: ReturnType<typeof setTimeout> | undefined;
        const append = (text: string) => {
            data.output += text;
            if (!updateTimer) updateTimer = setTimeout(() => {
                updateTimer = undefined;
                this.resultView.update(result);
            }, 50);
        };
        const subscription = cancellation.token.onCancellationRequested(() => {
            data.state = 'stopping';
            data.summary = 'Stopping workflow...';
            append(`\n${data.summary}\n`);
            abortController.abort();
            this.resultView.update(result);
        });
        const toolSubscription = toolToken?.onCancellationRequested(() => cancellation.cancel());
        try {
            await this.resultView.show(result);
            if (toolToken?.isCancellationRequested) cancellation.cancel();
            append(`Workflow: ${workflow.name}\n`);
            await executeWorkflow(workflow, async (step, index) => {
                data.summary = `${index + 1}/${workflow.steps.length}: ${step.name}`;
                append(`\n[${data.summary}]\n`);
                this.resultView.update(result);
                if (step.type === 'command') {
                    await executeLocalCommand(step.command, step.cwd, append, abortController.signal);
                } else {
                    const { server, credentials } = await resolveSshConnection(step.serverId);
                    if (cancellation.token.isCancellationRequested) throw new Error('Workflow cancelled.');
                    if (step.type === 'ssh') append(`${await executeSshCommand(server, credentials, step.command, abortController.signal)}\n`);
                    else if (step.action === 'download') await downloadSftpFile(server, credentials, step.remotePath, step.localPath, abortController.signal);
                    else await writeSftpFile(server, credentials, step.localPath, step.remotePath, abortController.signal);
                }
                append(`\nCompleted: ${step.name}\n`);
            }, () => cancellation.token.isCancellationRequested);
            data.state = 'success';
            data.summary = 'Workflow completed.';
            append(`${data.summary}\n`);
            return true;
        } catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            const cancelled = cancellation.token.isCancellationRequested && (message === 'Workflow cancelled.' || (error instanceof Error && error.name === 'AbortError'));
            data.state = cancelled ? 'cancelled' : 'error';
            data.summary = cancelled ? 'Workflow cancelled.' : message;
            append(`\nStopped: ${message}\n`);
            if (cancelled) return false;
            throw new WorkflowExecutionError(message, { cause: error });
        } finally {
            clearTimeout(updateTimer);
            this.resultView.update(result);
            toolSubscription?.dispose();
            subscription.dispose();
            cancellation.dispose();
            this.cancellation = undefined;
        }
    }

    dispose(): void {
        this.cancellation?.cancel();
        this.command.dispose();
    }
}