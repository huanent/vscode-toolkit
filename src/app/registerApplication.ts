import * as vscode from 'vscode';
import { registerDashboard } from '@/features/dashboard/panel';
import { registerCredential } from '@/features/credential/dashboard';
import { registerSourceControl } from '@/features/git/sourceControl';
import { generateGitignore } from '@/features/git/gitignoreService';
import { registerHttpClient } from '@/features/http/httpClient';
import { registerChat } from '@/features/chat/registerChat';
import { registerExplorer } from '@/features/explorer/registerExplorer';
import { createPerfTipsTracker } from '@/features/perftips/perftips';
import { registerPackageScriptWatcher, runPackageScript } from '@/features/scripts/packageScripts';
import { runScript } from '@/features/scripts/runScript';
import { registerScriptRuntimeWatcher } from '@/features/scripts/scriptRuntime';
import { registerXmlFormatter } from '@/features/xml/xmlFormatter';
import { registerSsh } from '@/features/ssh/registerSsh';
import { registerDatabase } from '@/features/database/registerDatabase';
import { registerContainer } from '@/features/container/registerContainer';
import { registerWorkflow } from '@/features/workflow/registerWorkflow';
import { ResultView } from '@/features/result/resultView';
import { registerExcelEditor } from '@/features/excel/editor';
import { registerArchiveEditor } from '@/features/archive/editor';
import { registerStorageBackup } from '@/host/registerStorageBackup';
import { registerConfigurationTools } from '@/features/configuration/tools';

export async function registerApplication(context: vscode.ExtensionContext): Promise<void> {
    registerStorageBackup(context);
    const resultView = await ResultView.create(context);
    context.subscriptions.push(resultView);
    context.subscriptions.push(vscode.window.registerWebviewViewProvider(ResultView.viewType, resultView, {
        webviewOptions: { retainContextWhenHidden: true },
    }));
    registerCredential(context);

    context.subscriptions.push(
        vscode.commands.registerCommand('vscode-toolkit.generateGitignore', () =>
            generateGitignore(context.extensionUri),
        ),
        ...['runDotnetScript', 'runShScript', 'runBatScript', 'runNodeScript', 'runBunScript'].map(
            command =>
                vscode.commands.registerCommand(`vscode-toolkit.${command}`, (uri, selectedUris) =>
                    runScript(context, uri, selectedUris),
                ),
        ),
        vscode.commands.registerCommand('vscode-toolkit.runNpmScript', runPackageScript),
        vscode.commands.registerCommand('vscode-toolkit.runBunPackageScript', runPackageScript),
        registerXmlFormatter(),
        registerExcelEditor(context),
        registerArchiveEditor(context),
    );
    registerPackageScriptWatcher(context);
    registerScriptRuntimeWatcher(context);
    registerSourceControl(context);
    registerHttpClient(context, resultView);
    await registerChat(context);
    await registerExplorer(context);
    await registerSsh(context);
    registerWorkflow(context, resultView);
    await registerDatabase(context, resultView);
    await registerContainer(context);
    registerDashboard(context);
    context.subscriptions.push(registerConfigurationTools(context));

    context.subscriptions.push(
        vscode.debug.registerDebugAdapterTrackerFactory('*', {
            createDebugAdapterTracker(session: vscode.DebugSession) {
                return createPerfTipsTracker(session);
            },
        }),
    );
}