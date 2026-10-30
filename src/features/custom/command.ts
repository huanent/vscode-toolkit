import { randomUUID } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import * as path from 'node:path';
import * as vscode from 'vscode';
import { resolveStorageDirectory } from '@/host/utils/storage';
import { serveWebviewData } from '@/host/webview-bridge';
import { getWebviewHtml } from '@/host/webview-html';
import type { CustomCommand, CustomCommandHostMessage, CustomCommandWebviewMessage } from '@/features/custom/protocol';

export async function registerCustomCommands(context: vscode.ExtensionContext): Promise<void> {
  let commands: CustomCommand[] = [];
  let panel: vscode.WebviewPanel | undefined;
  const file = () => path.join(resolveStorageDirectory(context, 'commands'), 'commands.json');
  const load = async () => {
    try {
      const data: unknown = JSON.parse(await readFile(file(), 'utf8'));
      if (!Array.isArray(data)) throw new Error('Commands must be an array.');
      commands = data as CustomCommand[];
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
      commands = [];
    }
  };
  const save = async (next: CustomCommand[]) => {
    await mkdir(path.dirname(file()), { recursive: true });
    await writeFile(file(), JSON.stringify(next, null, 2));
    commands = next;
  };
  const run = async (id: string, stack: string[] = []): Promise<void> => {
    const command = commands.find((entry) => entry.id === id);
    if (!command) throw new Error(`Custom command not found: ${id}`);
    if (stack.includes(id)) throw new Error('Recursive custom command execution is not allowed.');
    for (const step of command.steps) {
      if (step.command === 'toolkit.custom.commands.run' && typeof step.args[0] === 'string') {
        await run(step.args[0], [...stack, id]);
      } else {
        await vscode.commands.executeCommand(step.command, ...step.args);
      }
    }
  };
  try {
    await load();
  } catch (error) {
    void vscode.window.showErrorMessage(`Failed to load custom commands: ${String(error)}`);
  }
  context.subscriptions.push(
    vscode.commands.registerCommand('toolkit.custom.commands.run', async (id?: string) => {
      try {
        const selected =
          id ?? (await vscode.window.showQuickPick(commands.map((entry) => ({ label: entry.name, id: entry.id }))))?.id;
        if (selected) await run(selected);
      } catch (error) {
        void vscode.window.showErrorMessage(error instanceof Error ? error.message : String(error));
      }
    }),
    vscode.commands.registerCommand('toolkit.custom.commands.manage', () => {
      if (panel) return panel.reveal();
      panel = vscode.window.createWebviewPanel('toolkit.custom.commands', 'Commands', vscode.ViewColumn.One, {
        enableScripts: true,
        localResourceRoots: [vscode.Uri.joinPath(context.extensionUri, 'dist')],
        retainContextWhenHidden: true,
      });
      panel.iconPath = new vscode.ThemeIcon('terminal');
      const bridge = serveWebviewData(panel.webview, async () => commands);
      const listener = panel.webview.onDidReceiveMessage(async (message: CustomCommandWebviewMessage) => {
        try {
          if (message.type === 'listAvailableCommands') {
            const available = await vscode.commands.getCommands(true);
            await panel?.webview.postMessage({
              type: 'availableCommands',
              commands: available.sort(),
            } satisfies CustomCommandHostMessage);
            return;
          } else if (message.type === 'save') {
            const entry = { ...message.command, id: message.command.id || randomUUID() };
            if (
              !entry.name.trim() ||
              !entry.steps.length ||
              entry.steps.some((step) => !step.command.trim() || !Array.isArray(step.args))
            )
              throw new Error('A name and valid command steps are required.');
            await save([...commands.filter((item) => item.id !== entry.id), entry]);
          } else if (message.type === 'delete') {
            const command = commands.find((item) => item.id === message.id);
            if (!command) return;
            const confirmed = await vscode.window.showWarningMessage(
              `Delete ${command.name}?`,
              { modal: true },
              'Delete',
            );
            if (confirmed !== 'Delete') return;
            await save(commands.filter((item) => item.id !== message.id));
          } else if (message.type === 'run') {
            await run(message.id);
          } else if (message.type === 'shortcuts') {
            await vscode.env.clipboard.writeText(
              JSON.stringify({ key: '', command: 'toolkit.custom.commands.run', args: message.id }, null, 2),
            );
            await vscode.commands.executeCommand('workbench.action.openGlobalKeybindingsFile');
            void vscode.window.showInformationMessage(
              'A keybinding template was copied to the clipboard. Set its key and add it to keybindings.json.',
            );
          }
          await panel?.webview.postMessage({ type: 'updated', commands } satisfies CustomCommandHostMessage);
        } catch (error) {
          await panel?.webview.postMessage({
            type: 'error',
            message: error instanceof Error ? error.message : String(error),
          } satisfies CustomCommandHostMessage);
        }
      });
      panel.onDidDispose(() => {
        bridge.dispose();
        listener.dispose();
        panel = undefined;
      });
      panel.webview.html = getWebviewHtml(panel.webview, vscode.Uri.joinPath(context.extensionUri, 'dist'), {
        page: 'command',
        title: 'Commands',
      });
    }),
    vscode.commands.registerCommand('toolkit.custom.commands.add', () =>
      panel?.webview.postMessage({ type: 'add' } satisfies CustomCommandHostMessage),
    ),
    vscode.workspace.onDidChangeConfiguration((event) => {
      if (event.affectsConfiguration('toolkit.storagePath'))
        void load()
          .then(() => panel?.webview.postMessage({ type: 'updated', commands } satisfies CustomCommandHostMessage))
          .catch((error: unknown) => vscode.window.showErrorMessage(String(error)));
    }),
    { dispose: () => panel?.dispose() },
  );
}
