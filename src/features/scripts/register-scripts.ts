import * as vscode from 'vscode';
import { registerPackageScriptWatcher, runPackageScript } from './package-scripts';
import { runScript } from './run-script';
import { registerScriptRuntimeWatcher } from './script-runtime';

const scriptCommands = ['runDotnetScript', 'runShScript', 'runBatScript', 'runNodeScript', 'runBunScript'];

export function registerScripts(context: vscode.ExtensionContext): void {
  context.subscriptions.push(
    ...scriptCommands.map((command) =>
      vscode.commands.registerCommand(`toolkit.${command}`, (uri, selectedUris) =>
        runScript(context, uri, selectedUris),
      ),
    ),
    vscode.commands.registerCommand('toolkit.runNpmScript', runPackageScript),
    vscode.commands.registerCommand('toolkit.runBunPackageScript', runPackageScript),
  );
  registerPackageScriptWatcher(context);
  registerScriptRuntimeWatcher(context);
}
