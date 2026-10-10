import { executeLocalCommand } from './localCommand';
import { randomUUID } from 'node:crypto';
import * as vscode from 'vscode';
import type { Result, WorkflowResult } from '../result/protocol';
import type { ResultView } from '../result/resultView';
import { resolveSshConnection } from '../ssh/connectionService';
import { executeSshCommand } from '../ssh/sshCommand';
import { downloadSftpFile, writeSftpFile } from '../ssh/sftp';
import { executeWorkflow, type Workflow } from './workflow';

export class WorkflowExecutionError extends Error { }

export class WorkflowRunner implements vscode.Disposable {
    private readonly cancellations = new Set<vscode.CancellationTokenSource>();
    private result: Result | undefined;

    constructor(private readonly resultView: ResultView) { }

    showOutput(): void {
        if (this.result) void this.resultView.show(this.result);
        else void vscode.commands.executeCommand('vscode-toolkit.result.focus');
    }

    async run(workflow: Workflow, toolToken?: vscode.CancellationToken): Promise<boolean> {
        const cancellation = new vscode.CancellationTokenSource();
        const abortController = new AbortController();
        this.cancellations.add(cancellation);
        const data: WorkflowResult = {
            runId: randomUUID(), name: workflow.name, state: 'running', summary: 'Starting...', output: '',
            startedAt: Date.now(),
            steps: workflow.steps.map(step => ({ name: step.name, type: step.type, state: 'pending', output: '' })),
        };
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
            await this.resultView.show(result, false, () => cancellation.cancel());
            if (toolToken?.isCancellationRequested) cancellation.cancel();
            append(`Workflow: ${workflow.name}\n`);
            await executeWorkflow(workflow, async (step, index) => {
                const stepResult = data.steps[index];
                stepResult.state = 'running';
                stepResult.startedAt = Date.now();
                const appendStep = (text: string) => {
                    stepResult.output += text;
                    append(text);
                };
                data.summary = `${index + 1}/${workflow.steps.length}: ${step.name}`;
                append(`\n[${data.summary}]\n`);
                this.resultView.update(result);
                if (step.type === 'command') {
                    await executeLocalCommand(step.command, step.cwd, appendStep, abortController.signal);
                } else {
                    const { server, credentials } = await resolveSshConnection(step.serverId);
                    if (cancellation.token.isCancellationRequested) throw new Error('Workflow cancelled.');
                    if (step.type === 'ssh') {
                        await executeSshCommand(server, credentials, step.command, abortController.signal, appendStep, { pty: true });
                    } else {
                        const progress = (transferred: number, total: number) => {
                            if (stepResult.state !== 'running' || abortController.signal.aborted) return;
                            stepResult.progress = { transferred, total };
                            append('');
                        };
                        if (step.action === 'download') await downloadSftpFile(server, credentials, step.remotePath, step.localPath, abortController.signal, progress);
                        else await writeSftpFile(server, credentials, step.localPath, step.remotePath, abortController.signal, progress);
                    }
                }
                if (cancellation.token.isCancellationRequested) throw new Error('Workflow cancelled.');
                stepResult.state = 'success';
                stepResult.finishedAt = Date.now();
                append(`\nCompleted: ${step.name}\n`);
                this.resultView.update(result);
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
            for (const step of data.steps) {
                if (step.state === 'running') {
                    step.state = cancelled ? 'cancelled' : 'error';
                    step.finishedAt = Date.now();
                    step.output += `\n${data.summary}\n`;
                } else if (step.state === 'pending') step.state = 'skipped';
            }
            append(`\nStopped: ${message}\n`);
            if (cancelled) return false;
            throw new WorkflowExecutionError(message, { cause: error });
        } finally {
            data.finishedAt = Date.now();
            clearTimeout(updateTimer);
            this.resultView.update(result);
            toolSubscription?.dispose();
            subscription.dispose();
            cancellation.dispose();
            this.cancellations.delete(cancellation);
        }
    }

    dispose(): void {
        for (const cancellation of this.cancellations) cancellation.cancel();
    }
}