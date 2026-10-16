import * as vscode from 'vscode';
import type { HttpClientRequest } from './protocol';
import type { HttpClientService } from './http-client-service';

export function registerHttpClientTools(clients: HttpClientService): vscode.Disposable {
  return vscode.lm.registerTool<HttpClientRequest>('httpClientExecute', {
    prepareInvocation({ input }) {
      return {
        invocationMessage: `Sending ${input.method ?? 'GET'} request using HTTP client ${input.id}`,
        confirmationMessages: {
          title: 'Send HTTP request?',
          message: `Asset: ${input.id}\nMethod: ${input.method ?? 'GET'}\nPath: ${input.path}`,
        },
      };
    },
    async invoke({ input }, token) {
      const controller = new AbortController();
      const listener = token.onCancellationRequested(() => controller.abort());
      try {
        if (token.isCancellationRequested) controller.abort();
        const result = await clients.send(input, controller.signal);
        return new vscode.LanguageModelToolResult([new vscode.LanguageModelTextPart(JSON.stringify(result))]);
      } finally {
        listener.dispose();
      }
    },
  });
}
