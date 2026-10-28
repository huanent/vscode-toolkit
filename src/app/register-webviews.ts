import * as vscode from 'vscode';
import type { TempFilesView } from '@/features/temp/view-handler';
import type { PlaybookFilesView } from '@/features/playbook/view-handler';
import { createAssetsView } from '@/features/assets/view-handler';
import { AssetService } from '@/features/assets/service';
import { MysqlService } from '@/features/database/mysql/service';
import { PostgresqlService } from '@/features/database/postgresql/service';
import { registerPostgresqlQueryEditor } from '@/features/database/postgresql/query-editor';
import { registerMysqlEditor } from '@/features/database/mysql/editor';
import { registerRemoteSqlite } from '@/features/database/sqlite/service';
import { registerRemoteArchive } from '@/features/archive/service';
import { SshService } from '@/features/ssh/ssh-service';
import { registerSftpEditor } from '@/features/ssh/sftp/editor';
import { registerSshTools } from '@/features/ssh/tools';
import { registerDatabaseTools } from '@/features/database/tools';
import { registerAssetTools } from '@/features/assets/tools';
import { HttpClientService } from '@/features/http/http-client-service';
import { registerHttpClientTools } from '@/features/http/tools';
import { createPlaybookEditorUri, registerPlaybookEditor, playbookEditorViewType } from '@/features/playbook/editor';
import { PlaybookResultService } from '@/features/playbook/result-service';
import { requestPlaybookEnvironment } from '@/features/playbook/run-form';
import { registerPlaybookTools } from '@/features/playbook/tools';
import { createResultViewHandler } from '@/features/result/view-handler';
import type { ResultTaskService } from '@/features/result/task-service';
import { WebviewViewProvider, type WebviewViewHandler, composeWebviewHandlers } from '@/host/webview-view-provider';
import { CredentialService } from '@/features/credential/service';
import { resolveStorageRoots } from '@/host/utils/storage';
import type {
  CollapseDashboardTreeMessage,
  DashboardSearchRequest,
  DashboardSearchResult,
  SearchDashboardTreeMessage,
} from '@/shared/dashboard-protocol';
import { searchPlaybookContents } from '@/features/playbook/service';
import { searchTempContents } from '@/features/temp/service';
import { resolveStorageDirectory } from '@/host/utils/storage';

interface WebviewRegistration {
  id: string;
  page: string;
  handler: WebviewViewHandler;
}

export function registerWebviews(
  context: vscode.ExtensionContext,
  tasks: ResultTaskService,
  tempFiles: TempFilesView,
  playbookFiles: PlaybookFilesView,
): void {
  const assetsUri = vscode.Uri.file(__dirname);
  const assets = new AssetService(context);
  const credentials = new CredentialService(context);
  const ssh = new SshService(assets, credentials, context.globalState);
  context.subscriptions.push(registerRemoteSqlite(ssh));
  context.subscriptions.push(registerRemoteArchive(ssh));
  const mysql = new MysqlService(assets, credentials, ssh);
  const postgresql = new PostgresqlService(assets, credentials, ssh, (asset) => openPostgresqlQuery(asset));
  const openPostgresqlQuery = registerPostgresqlQueryEditor(context, postgresql, tasks);
  const databases = [mysql, postgresql];
  registerSftpEditor(context, ssh, assets);
  const httpClients = new HttpClientService(assets, credentials);
  const playbookResults = new PlaybookResultService(tasks, ssh, (name, environment, cancellation) =>
    requestPlaybookEnvironment(context, name, environment, cancellation),
  );
  context.subscriptions.push(
    registerAssetTools(assets),
    registerHttpClientTools(httpClients),
    registerDatabaseTools(assets, databases),
    ...registerSshTools(ssh),
    ...registerPlaybookTools(context, ssh, playbookResults, playbookFiles.refresh),
  );
  playbookFiles.setEditorOpener(async (id, name, parentId) => {
    await vscode.commands.executeCommand(
      'vscode.openWith',
      createPlaybookEditorUri(id, name, parentId),
      playbookEditorViewType,
    );
  });
  playbookFiles.setRunner((name, playbook) => playbookResults.runPlaybook(name, playbook));
  context.subscriptions.push(
    ...databases,
    ssh,
    httpClients,
    registerMysqlEditor(context, mysql, tasks),
    registerPlaybookEditor(
      context,
      () => resolveStorageRoots(context, 'playbooks'),
      ssh,
      assets,
      playbookResults,
      playbookFiles.refresh,
    ),
  );
  const assetsView = createAssetsView(context, assets, [...databases, ssh, httpClients], credentials);
  const composedDashboardHandler = composeWebviewHandlers({
    temp: tempFiles.handler,
    playbook: playbookFiles.handler,
    assets: assetsView,
  });
  let dashboardWebview: vscode.Webview | undefined;
  context.subscriptions.push(
    vscode.commands.registerCommand('toolkit.dashboard.refresh', async () => {
      try {
        await Promise.all([assetsView.refresh(), playbookFiles.refresh(), tempFiles.refresh()]);
      } catch (error) {
        await vscode.window.showErrorMessage(error instanceof Error ? error.message : String(error), { modal: true });
      }
    }),
    vscode.commands.registerCommand('toolkit.dashboard.collapseAll', () => {
      void dashboardWebview?.postMessage({ type: 'collapseActiveTree' } satisfies CollapseDashboardTreeMessage);
    }),
    vscode.commands.registerCommand('toolkit.dashboard.search', () => {
      void dashboardWebview?.postMessage({ type: 'searchActiveTree' } satisfies SearchDashboardTreeMessage);
    }),
  );
  const dashboardHandler: WebviewViewHandler = {
    ...composedDashboardHandler,
    onMessage: async (message, webview) => {
      if (isDashboardSearchRequest(message)) {
        try {
          const query = message.query.trim().toLocaleLowerCase();
          const matches = !query
            ? []
            : message.tab === 'assets'
              ? (await assets.list())
                  .filter((asset) => JSON.stringify(asset).toLocaleLowerCase().includes(query))
                  .map((asset) => asset.id)
              : message.tab === 'playbook'
                ? await searchPlaybookContents(resolveStorageRoots(context, 'playbooks'), query)
                : await searchTempContents(resolveStorageDirectory(context, 'temp'), query);
          await webview.postMessage({
            type: 'dashboardSearchResult',
            requestId: message.requestId,
            matches,
          } satisfies DashboardSearchResult);
        } catch (error) {
          await webview.postMessage({
            type: 'dashboardSearchError',
            requestId: message.requestId,
            message: error instanceof Error ? error.message : String(error),
          } satisfies DashboardSearchResult);
        }
        return;
      }
      await composedDashboardHandler.onMessage?.(message, webview);
    },
    onResolve: (webview) => {
      dashboardWebview = webview;
      composedDashboardHandler.onResolve?.(webview);
    },
    onDispose: () => {
      dashboardWebview = undefined;
      composedDashboardHandler.onDispose?.();
    },
  };
  const views: WebviewRegistration[] = [
    { id: 'toolkit.dashboard', page: 'dashboard', handler: dashboardHandler },
    { id: 'toolkit.results', page: 'result', handler: createResultViewHandler(tasks) },
  ];

  for (const view of views) {
    context.subscriptions.push(
      vscode.window.registerWebviewViewProvider(view.id, new WebviewViewProvider(assetsUri, view.page, view.handler)),
    );
  }
}

function isDashboardSearchRequest(message: unknown): message is DashboardSearchRequest {
  if (!message || typeof message !== 'object') return false;
  const value = message as Record<string, unknown>;
  return (
    value.type === 'searchDashboardContents' &&
    (value.tab === 'assets' || value.tab === 'playbook' || value.tab === 'temp') &&
    typeof value.query === 'string' &&
    typeof value.requestId === 'number'
  );
}
