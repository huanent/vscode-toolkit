import * as vscode from 'vscode';
import type { SshService } from './ssh-service';

interface RunSshCommandInput {
  id: string;
  command: string;
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
      async invoke({ input }) {
        const id = await ssh.requireAiAccess(input.id);
        const result = await ssh.runCommand(id, input.command);
        return new vscode.LanguageModelToolResult([new vscode.LanguageModelTextPart(JSON.stringify(result))]);
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
      async invoke({ input }) {
        const id = await ssh.requireAiAccess(input.id);
        await ssh.transferFile(id, input.direction, input.localPath, input.remotePath);
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
