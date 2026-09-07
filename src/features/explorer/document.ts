import * as vscode from 'vscode';
import type { ExplorerViewState } from './types';

export class ExplorerDocument implements vscode.CustomDocument {
	latestViewState: ExplorerViewState;

	constructor(
		readonly uri: vscode.Uri,
		readonly rootUri: vscode.Uri,
	) {
		this.latestViewState = {
			currentUri: rootUri.toString(),
			history: [],
		};
	}

	dispose(): void {}
}
