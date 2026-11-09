import * as vscode from 'vscode';
import type { SshService } from './ssh-service';

interface RunSshCommandInput {
  id: string;
  command: string;
  timeoutSeconds?: number;
}

interface TransferSftpFileInput {
  id: string;
  direction: 'upload' | 'download';
  localPath: string;
  remotePath: string;
}

export function registerSshTools(ssh: SshService): vscode.Disposable[] {
  return [
    vscode.lm.registerTool<RunSshCommandInput>('sshExecute', {
      prepareInvocation({ input }) {
        return {
          invocationMessage: `Running SSH command on asset ${input.id}`,
          confirmationMessages: {
            title: 'Run remote SSH command?',
            message: `Asset: ${input.id}\nCommand: ${input.command}`,
          },
        };
      },
      async invoke({ input }, token) {
        const { timeoutSeconds } = input;
        if (timeoutSeconds !== undefined && (!Number.isInteger(timeoutSeconds) || timeoutSeconds < 1 || timeoutSeconds > 2147483)) {
          throw new Error('SSH timeout must be an integer between 1 and 2147483 seconds.');
        }
        const id = await ssh.requireAiAccess(input.id);
        return withCancellation(token, async (signal) => {
          const controller = new AbortController();
          const abort = () => controller.abort();
          signal.addEventListener('abort', abort, { once: true });
          if (signal.aborted) controller.abort();
          let timedOut = false;
          const timer = timeoutSeconds === undefined ? undefined : setTimeout(() => {
            timedOut = true;
            controller.abort();
          }, timeoutSeconds * 1000);
          try {
            const result = await ssh.runLoginCommand(id, input.command, controller.signal);
            return new vscode.LanguageModelToolResult([new vscode.LanguageModelTextPart(JSON.stringify(result))]);
          } catch (error) {
            if (timedOut) throw new Error(`SSH command timed out after ${timeoutSeconds} seconds.`);
            throw error;
          } finally {
            if (timer !== undefined) clearTimeout(timer);
            signal.removeEventListener('abort', abort);
          }
        });
      },
    }),
    vscode.lm.registerTool<TransferSftpFileInput>('sftpTransfer', {
      prepareInvocation({ input }) {
        return {
          invocationMessage: `${input.direction === 'upload' ? 'Uploading' : 'Downloading'} SFTP file on asset ${input.id}`,
          confirmationMessages: {
            title: 'Transfer file over SFTP?',
            message: `Asset: ${input.id}\nDirection: ${input.direction}\nLocal path: ${input.localPath}\nRemote path: ${input.remotePath}`,
          },
        };
      },
      async invoke({ input }, token) {
        const id = await ssh.requireAiAccess(input.id);
        await withCancellation(token, (signal) =>
          ssh.transferFile(id, input.direction, input.localPath, input.remotePath, signal),
        );
        return new vscode.LanguageModelToolResult([
          new vscode.LanguageModelTextPart(
            JSON.stringify({
              success: true,
              direction: input.direction,
              localPath: input.localPath,
              remotePath: input.remotePath,
            }),
          ),
        ]);
      },
    }),
  ];
}

async function withCancellation<T>(
  token: vscode.CancellationToken,
  run: (signal: AbortSignal) => Promise<T>,
): Promise<T> {
  const controller = new AbortController();
  const listener = token.onCancellationRequested(() => controller.abort());
  try {
    if (token.isCancellationRequested) controller.abort();
    return await run(controller.signal);
  } finally {
    listener.dispose();
  }
}
