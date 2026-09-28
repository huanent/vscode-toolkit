import * as vscode from 'vscode';
import { registerCommands } from '@/host/register-commands';
import { registerWebviews } from '@/host/register-webviews';
import { registerSourceControl } from '@/features/git/source-control';
import { registerXmlFormatter } from '@/features/xml/register-xml-formatter';
import { registerArchiveEditor } from '@/features/archive/editor';
import { registerExcelEditor } from '@/features/excel/editor';

export function activate(context: vscode.ExtensionContext) {
	registerCommands(context);
	context.subscriptions.push(registerXmlFormatter());
	context.subscriptions.push(registerArchiveEditor(context));
	context.subscriptions.push(registerExcelEditor(context));
	registerSourceControl(context);
	registerWebviews(context);
}

// This method is called when your extension is deactivated
export function deactivate() {}
