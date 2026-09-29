import * as vscode from 'vscode';
import { registerCommands } from '@/host/register-commands';
import { registerWebviews } from '@/host/register-webviews';
import { createPerfTipsTracker } from '@/features/perftips/perftips';
import { registerSourceControl } from '@/features/git/source-control';
import { registerXmlFormatter } from '@/features/xml/register-xml-formatter';
import { registerArchiveEditor } from '@/features/archive/editor';
import { registerSpreadsheetEditor } from '@/features/spreadsheet/editor';
import { registerSqliteEditor } from '@/features/database/sqlite-editor';
import { registerHttpLanguage } from '@/features/http/register-http';

export function activate(context: vscode.ExtensionContext) {
  registerCommands(context);
  context.subscriptions.push(registerXmlFormatter());
  context.subscriptions.push(registerHttpLanguage());
  context.subscriptions.push(registerArchiveEditor(context));
  context.subscriptions.push(registerSpreadsheetEditor(context));
  context.subscriptions.push(registerSqliteEditor(context));
  registerSourceControl(context);
  context.subscriptions.push(
    vscode.debug.registerDebugAdapterTrackerFactory('*', {
      createDebugAdapterTracker(session) {
        return createPerfTipsTracker(session);
      },
    }),
  );
  registerWebviews(context);
}

// This method is called when your extension is deactivated
export function deactivate() {}
