import * as os from 'node:os';
import * as vscode from 'vscode';

const fileName = '.gitignore';
const userRulesMarker =
	"Custom rules (everything added below won't be overridden when using Update)";
const legacyUserRulesMarker =
	"Custom rules (everything added below won't be overriden by 'Generate .gitignore File' if you use 'Update' option)";
const banner = 'File created using Toolkit';

interface GitignoreItem extends vscode.QuickPickItem {
	picked: boolean;
}

export async function generateGitignore(extensionUri: vscode.Uri): Promise<void> {
	const folder = await selectWorkspaceFolder();
	if (folder === undefined && vscode.workspace.workspaceFolders?.length) {
		return;
	}

	const fileUri = folder ? vscode.Uri.joinPath(folder.uri, fileName) : undefined;
	const exists = fileUri ? await fileExists(fileUri) : false;
	const shouldOverride = exists ? await selectWriteMode() : true;
	if (shouldOverride === undefined) {
		return;
	}

	const currentContent = exists && fileUri ? await readFile(fileUri) : undefined;
	const items = await vscode.window.withProgress(
		{
			location: vscode.ProgressLocation.Window,
			title: 'Loading .gitignore templates...',
		},
		() => loadTemplateItems(extensionUri, currentContent, !shouldOverride),
	);
	if (items === undefined) {
		void vscode.window.showErrorMessage('Unable to load the bundled .gitignore templates.');
		return;
	}

	if (items.length === 0) {
		void vscode.window.showErrorMessage('The .gitignore template service returned an empty list.');
		return;
	}

	const selected = await selectTemplates(items);
	if (!selected?.length) {
		return;
	}

	try {
		await vscode.window.withProgress(
			{
				location: vscode.ProgressLocation.Notification,
				title: `Generating ${fileName}`,
			},
			async () => {
				const selectedTemplates = selected.map(item => item.label);
				const generated = await generateFromTemplates(extensionUri, selectedTemplates);
				if (generated === undefined) {
					void vscode.window.showErrorMessage('Unable to read the bundled .gitignore templates.');
					return;
				}

				const content = buildFile(
					selectedTemplates,
					generated,
					shouldOverride ? undefined : currentContent,
				);
				if (fileUri) {
					await vscode.workspace.fs.writeFile(fileUri, Buffer.from(content, 'utf8'));
					const document = await vscode.workspace.openTextDocument(fileUri);
					await vscode.window.showTextDocument(document);
				} else {
					const document = await vscode.workspace.openTextDocument({ content, language: 'ignore' });
					await vscode.window.showTextDocument(document);
				}

				void vscode.window.setStatusBarMessage(`${fileName} generated`, 3000);
			},
		);
	} catch {
		void vscode.window.showErrorMessage(`Unable to save ${fileName}.`);
	}
}

async function selectWorkspaceFolder(): Promise<vscode.WorkspaceFolder | undefined> {
	const folders = vscode.workspace.workspaceFolders;
	if (!folders?.length) {
		return undefined;
	}
	if (folders.length === 1) {
		return folders[0];
	}

	const selected = await vscode.window.showQuickPick(
		folders.map(folder => ({ label: folder.name, folder })),
		{ placeHolder: `Where should ${fileName} be generated?` },
	);
	return selected?.folder;
}

async function selectWriteMode(): Promise<boolean | undefined> {
	const selected = await vscode.window.showQuickPick(
		[
			{
				label: 'Update',
				description: 'Keep custom rules and update generated rules',
				override: false,
			},
			{ label: 'Override', description: 'Replace the entire .gitignore file', override: true },
		],
		{ placeHolder: `${fileName} exists. How should it be changed?` },
	);
	return selected?.override;
}

function selectTemplates(items: GitignoreItem[]): Promise<readonly GitignoreItem[] | undefined> {
	return new Promise(resolve => {
		const quickPick = vscode.window.createQuickPick<GitignoreItem>();
		quickPick.canSelectMany = true;
		quickPick.matchOnDescription = true;
		quickPick.placeholder = 'Select environments, languages, and tools';
		quickPick.items = items;
		quickPick.selectedItems = items.filter(item => item.picked);

		let accepted = false;
		quickPick.onDidAccept(() => {
			accepted = true;
			resolve(quickPick.selectedItems);
			quickPick.hide();
		});
		quickPick.onDidHide(() => {
			if (!accepted) {
				resolve(undefined);
			}
			quickPick.dispose();
		});
		quickPick.show();
	});
}

async function loadTemplateItems(
	extensionUri: vscode.Uri,
	currentContent: string | undefined,
	keepCurrent: boolean,
): Promise<GitignoreItem[] | undefined> {
	const list = await readFile(
		vscode.Uri.joinPath(extensionUri, 'resources', 'gitignore', 'templates.json'),
	);
	if (list === undefined) {
		return undefined;
	}

	const selected = new Set(
		keepCurrent
			? getCurrentItems(currentContent)
			: ['visualstudiocode', getOperatingSystem()].filter(Boolean),
	);
	const templates = parseTemplateList(list);
	return templates
		.map(label => ({ label, picked: selected.has(label) }))
		.sort((left, right) => Number(right.picked) - Number(left.picked));
}

function parseTemplateList(list: string): string[] {
	try {
		const templates: unknown = JSON.parse(list);
		return Array.isArray(templates)
			? templates.filter((item): item is string => typeof item === 'string')
			: [];
	} catch {
		return [];
	}
}

function getCurrentItems(content: string | undefined): string[] {
	const match = /^# Created by.+\/(.+)$/m.exec(content ?? '');
	return match?.[1]?.split(',') ?? [];
}

function getOperatingSystem(): string {
	const systems: Partial<Record<NodeJS.Platform, string>> = {
		darwin: 'macos',
		linux: 'linux',
		win32: 'windows',
	};
	return systems[os.platform()] ?? '';
}

function buildFile(
	selectedTemplates: readonly string[],
	generated: string,
	currentContent: string | undefined,
): string {
	const customRules = getCustomRules(currentContent);
	const output = [
		`# ${banner}`,
		`# Created by Toolkit/${selectedTemplates.join(',')}`,
		'',
		generated.trim(),
		`# ${userRulesMarker}`,
	];
	if (customRules) {
		output.push('', customRules);
	}
	return `${output.join('\n')}\n`;
}

async function generateFromTemplates(
	extensionUri: vscode.Uri,
	templates: readonly string[],
): Promise<string | undefined> {
	try {
		const contents = await Promise.all(
			templates.map(async template => {
				const uri = vscode.Uri.joinPath(
					extensionUri,
					'resources',
					'gitignore',
					'templates',
					`${template}.gitignore`,
				);
				const content = await readFile(uri);
				if (content === undefined) {
					throw new Error(`Missing template: ${template}`);
				}
				return stripTemplateMetadata(content);
			}),
		);
		return contents.join('\n\n');
	} catch {
		return undefined;
	}
}

function stripTemplateMetadata(content: string): string {
	return content
		.replace(/^# Created by https:\/\/www\.toptal\.com\/developers\/gitignore\/api\/.*\r?\n/, '')
		.replace(/^# Edit at https:\/\/www\.toptal\.com\/developers\/gitignore\?templates=.*\r?\n?/, '')
		.trim();
}

function getCustomRules(content: string | undefined): string | undefined {
	for (const marker of [userRulesMarker, legacyUserRulesMarker]) {
		const customRules = content?.split(marker)[1]?.trim();
		if (customRules) {
			return customRules;
		}
	}
	return undefined;
}

async function fileExists(uri: vscode.Uri): Promise<boolean> {
	try {
		await vscode.workspace.fs.stat(uri);
		return true;
	} catch {
		return false;
	}
}

async function readFile(uri: vscode.Uri): Promise<string | undefined> {
	try {
		return Buffer.from(await vscode.workspace.fs.readFile(uri)).toString('utf8');
	} catch {
		return undefined;
	}
}
