import * as vscode from 'vscode';
import type { HttpRequestData } from './protocol';
import type { ResultTaskService } from '@/features/result/task-service';
import { executeHttpRequest } from './http-client';

export class HttpResultService {
  constructor(private readonly tasks: ResultTaskService) {}

  public async focusResultView(): Promise<void> {
    try {
      await vscode.commands.executeCommand('toolkit.result.focus');
    } catch {
      // View might not be registered yet in some tests
    }
  }

  public async sendRequest(request: HttpRequestData): Promise<void> {
    await this.focusResultView();
    await this.tasks.startTask({
      kind: 'http',
      title: `${request.method.toUpperCase()} ${request.url}`,
      input: request,
      run: (signal) => executeHttpRequest(request, { signal }),
    });
  }
}
