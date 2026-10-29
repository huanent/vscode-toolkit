import { execFile } from 'node:child_process';
import { mkdir, writeFile } from 'node:fs/promises';
import * as path from 'node:path';
import { promisify } from 'node:util';
import * as vscode from 'vscode';
import { resolveStorageDirectory } from '@/host/utils/storage';

const execute = promisify(execFile);
const template = `export default function() {
  const now = new Date();
  const time = now.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
  const date = now.toLocaleDateString(undefined, { dateStyle: 'full' });
  const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;

  return {
    label: '$(clock) ' + time,
    hover: [
      '### Local time',
      '**Date:** ' + date,
      '**Time zone:** ' + timeZone,
      '**Updated:** ' + now.toLocaleTimeString(),
    ].join('\\n\\n'),
  };
}
`;

export function registerStatusBar(context: vscode.ExtensionContext): void {
  const item = vscode.window.createStatusBarItem('toolkit.custom.statusBar', vscode.StatusBarAlignment.Left);
  const output = vscode.window.createOutputChannel('Toolkit Status Bar');
  let timer: NodeJS.Timeout | undefined;
  let generation = 0;
  let visible = false;
  let hover: string | undefined;

  async function ensureScript(): Promise<string> {
    const directory = resolveStorageDirectory(context, 'custom');
    const script = path.join(directory, 'statusBar.ts');
    await mkdir(directory, { recursive: true });
    try {
      await writeFile(script, template, { flag: 'wx' });
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'EEXIST') throw error;
    }
    return script;
  }

  async function initialize(): Promise<void> {
    const current = ++generation;
    if (timer) clearTimeout(timer);
    item.hide();
    visible = false;
    try {
      const script = await ensureScript();
      if (
        current !== generation ||
        !vscode.workspace.getConfiguration('toolkit').get('custom.statusBar.enabled', false)
      )
        return;
      const interval =
        Math.max(1, vscode.workspace.getConfiguration('toolkit').get('custom.statusBar.interval', 3)) * 1000;
      const refresh = async () => {
        try {
          const { stdout } = await execute(
            process.execPath,
            [
              '-e',
              'const { pathToFileURL } = require("node:url"); console.log = console.error; (async () => { const module = await import(pathToFileURL(process.argv[1]).href); const result = await module.default(); process.stdout.write(JSON.stringify(result)); })().catch(error => { console.error(error); process.exitCode = 1; });',
              script,
            ],
            {
              timeout: 30000,
              maxBuffer: 1024 * 1024,
              env: { ...process.env, ELECTRON_RUN_AS_NODE: '1', NODE_OPTIONS: '' },
            },
          );
          const result: unknown = JSON.parse(stdout);
          if (
            !result ||
            typeof result !== 'object' ||
            !('label' in result) ||
            typeof result.label !== 'string' ||
            !('hover' in result) ||
            typeof result.hover !== 'string'
          ) {
            throw new Error('The script must return an object with string label and hover properties.');
          }
          if (current !== generation) return;
          if (item.text !== result.label) item.text = result.label;
          if (hover !== result.hover) {
            const tooltip = new vscode.MarkdownString(result.hover, true);
            tooltip.supportHtml = true;
            item.tooltip = tooltip;
            hover = result.hover;
          }
          if (!visible) {
            item.show();
            visible = true;
          }
        } catch (error) {
          if (current !== generation) return;
          item.hide();
          visible = false;
          output.appendLine(error instanceof Error ? error.message : String(error));
        }
        if (current === generation) timer = setTimeout(() => void refresh(), interval);
      };
      void refresh();
    } catch (error) {
      if (current === generation) {
        output.appendLine(error instanceof Error ? error.message : String(error));
        void vscode.window.showErrorMessage(
          'Failed to initialize custom status bar. See Toolkit Status Bar output for details.',
        );
      }
    }
  }

  context.subscriptions.push(
    item,
    output,
    vscode.commands.registerCommand('toolkit.custom.statusBar.editScript', async () => {
      const script = await ensureScript();
      await vscode.window.showTextDocument(vscode.Uri.file(script));
    }),
    vscode.workspace.onDidChangeConfiguration((event) => {
      if (event.affectsConfiguration('toolkit.storagePath') || event.affectsConfiguration('toolkit.custom.statusBar'))
        void initialize();
    }),
    {
      dispose: () => {
        generation++;
        if (timer) clearTimeout(timer);
      },
    },
  );
  void initialize();
}
