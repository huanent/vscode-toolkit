import * as vscode from 'vscode';
import type { HttpRequestData } from './protocol';
import { resultTaskService } from '@/features/result/task-service';
import { executeHttpRequest } from './http-client';

export class HttpResultService {
  private static instance: HttpResultService | undefined;

  public static getInstance(): HttpResultService {
    if (!this.instance) {
      this.instance = new HttpResultService();
    }
    return this.instance;
  }

  public async focusResultView(): Promise<void> {
    try {
      await vscode.commands.executeCommand('toolkit.result.focus');
    } catch {
      // View might not be registered yet in some tests
    }
  }

  public async sendRequest(request: HttpRequestData): Promise<void> {
    await this.focusResultView();
    await resultTaskService.startTask({
      kind: 'http',
      title: `${request.method.toUpperCase()} ${request.url}`,
      input: request,
      run: (signal) => executeHttpRequest(request, { signal }),
    });
  }
}
