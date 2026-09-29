import * as vscode from 'vscode';
import type { HttpRequestData, HttpResultState, ResultHostMessage } from './protocol';
import { executeHttpRequest } from './http-client';

export class HttpResultService {
  private static instance: HttpResultService | undefined;
  private state: HttpResultState = { status: 'idle' };
  private activeWebview: vscode.Webview | undefined;

  public static getInstance(): HttpResultService {
    if (!this.instance) {
      this.instance = new HttpResultService();
    }
    return this.instance;
  }

  public getState(): HttpResultState {
    return this.state;
  }

  public setActiveWebview(webview: vscode.Webview | undefined): void {
    this.activeWebview = webview;
  }

  public async setState(state: HttpResultState): Promise<void> {
    this.state = state;
    if (this.activeWebview) {
      await this.activeWebview.postMessage({
        type: 'resultStateUpdated',
        state,
      } satisfies ResultHostMessage);
    }
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
    await this.setState({
      status: 'pending',
      request,
      timestamp: Date.now(),
    });

    try {
      const response = await executeHttpRequest(request);
      await this.setState({
        status: 'success',
        response,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      await this.setState({
        status: 'error',
        error: {
          message,
          timestamp: Date.now(),
          request,
        },
      });
    }
  }
}
