import { execFile } from 'node:child_process';
import * as path from 'node:path';
import { promisify } from 'node:util';
import * as vscode from 'vscode';

const execFileAsync = promisify(execFile);

/** VS Code exposes clipboard text only; file-manager copies need the native file list. */
export async function readClipboardFiles(): Promise<vscode.Uri[]> {
  const native = await readNativeFileList();
  const values = native || (await vscode.env.clipboard.readText());
  const files = values.split(/\r?\n/).flatMap((line) => {
    const value = line.trim();
    if (!value || value.startsWith('#')) return [];
    if (path.isAbsolute(value)) return [vscode.Uri.file(value)];
    if (/^[a-z][a-z\d+.-]*:\/\//i.test(value)) {
      try {
        return [vscode.Uri.parse(value, true)];
      } catch {
        return [];
      }
    }
    return [];
  });
  return [...new Map(files.map((uri) => [uri.toString(), uri])).values()];
}

async function readNativeFileList(): Promise<string> {
  const commands: [string, string[]][] =
    process.platform === 'darwin'
      ? [
          [
            '/usr/bin/osascript',
            [
              '-l',
              'JavaScript',
              '-e',
              `ObjC.import('AppKit');
const board = $.NSPasteboard.generalPasteboard;
const codeData = board.dataForType('code/file-list');
const codeFiles = codeData ? $.NSString.alloc.initWithDataEncoding(codeData, $.NSUTF8StringEncoding) : null;
const paths = [];
if (codeFiles && ObjC.unwrap(codeFiles)) {
  paths.push(ObjC.unwrap(codeFiles));
} else {
  const items = board.pasteboardItems;
  if (items) {
    for (let i = 0; i < items.count; i++) {
      const value = items.objectAtIndex(i).stringForType('public.file-url');
      if (!value) continue;
      const url = $.NSURL.URLWithString(value).filePathURL;
      if (url) paths.push(ObjC.unwrap(url.absoluteString));
    }
  }
}
paths.join('\\n');`,
            ],
          ],
        ]
      : process.platform === 'win32'
        ? [
            [
              'powershell.exe',
              [
                '-NoProfile',
                '-NonInteractive',
                '-STA',
                '-Command',
                '[Console]::OutputEncoding = [System.Text.Encoding]::UTF8; Add-Type -AssemblyName System.Windows.Forms; [System.Windows.Forms.Clipboard]::GetFileDropList()',
              ],
            ],
          ]
        : [
            ['wl-paste', ['--no-newline', '--type', 'text/uri-list']],
            ['xclip', ['-selection', 'clipboard', '-o', '-t', 'text/uri-list']],
            ['xclip', ['-selection', 'clipboard', '-o', '-t', 'x-special/gnome-copied-files']],
          ];
  for (const [command, args] of commands) {
    try {
      const { stdout } = await execFileAsync(command, args, { timeout: 3000, maxBuffer: 4 * 1024 * 1024 });
      if (stdout.trim()) return stdout;
    } catch {
      // Native formats or clipboard utilities may be unavailable; try the next format or text.
    }
  }
  return '';
}
