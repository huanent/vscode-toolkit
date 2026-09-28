import * as path from 'node:path';
import * as vscode from 'vscode';
import { serveWebviewData } from '@/host/webview-bridge';
import { getWebviewHtml } from '@/host/webview-html';

export interface WebviewEditorDefinition<TData> {
  /** Must match a `contributes.customEditors[].viewType` entry in `package.json`. */
  viewType: string;
  /** Page directory name under `src/webview/pages`. */
  page: string;
  /** Theme icon id, for example `file-zip`. */
  icon?: string;
  /** Rejects unsupported documents when the editor opens. */
  validate?: (uri: vscode.Uri) => void;
  /** Reads the payload posted to the webview after it signals `ready`. */
  load: (uri: vscode.Uri) => Promise<TData>;
  /** Values exposed on the root element; defaults to the document file name. */
  data?: (uri: vscode.Uri) => Record<string, string>;
}

/**
 * Registers a read-only custom editor backed by a built webview page.
 * Features only declare how to identify and load a document; the panel options,
 * asset URLs, content security policy, and message handshake are handled here.
 */
export function registerWebviewEditor<TData>(
  context: vscode.ExtensionContext,
  definition: WebviewEditorDefinition<TData>,
): vscode.Disposable {
  const assetsUri = vscode.Uri.joinPath(context.extensionUri, 'dist');
  const documentData = definition.data ?? ((uri: vscode.Uri) => ({ name: baseName(uri) }));

  return vscode.window.registerCustomEditorProvider(
    definition.viewType,
    {
      openCustomDocument: (uri: vscode.Uri) => {
        definition.validate?.(uri);
        return { uri, dispose() {} };
      },
      resolveCustomEditor: (document: vscode.CustomDocument, panel: vscode.WebviewPanel) => {
        const uri = (document as vscode.CustomDocument & { uri: vscode.Uri }).uri;
        panel.webview.options = { enableScripts: true, localResourceRoots: [assetsUri] };
        if (definition.icon) panel.iconPath = new vscode.ThemeIcon(definition.icon);

        const bridge = serveWebviewData(panel.webview, () => definition.load(uri));
        panel.onDidDispose(() => bridge.dispose());
        panel.webview.html = getWebviewHtml(panel.webview, assetsUri, {
          page: definition.page,
          title: baseName(uri),
          data: documentData(uri),
        });
      },
    },
    { supportsMultipleEditorsPerDocument: false, webviewOptions: { retainContextWhenHidden: true } },
  );
}

function baseName(uri: vscode.Uri): string {
  return path.posix.basename(uri.path);
}
