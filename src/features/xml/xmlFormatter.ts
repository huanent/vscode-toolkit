import * as vscode from 'vscode';
import formatXml from 'xml-formatter';

export function registerXmlFormatter(): vscode.Disposable {
	return vscode.languages.registerDocumentFormattingEditProvider('xml', {
		provideDocumentFormattingEdits(document, options) {
			const source = document.getText();
			const indentation = options.insertSpaces ? ' '.repeat(options.tabSize) : '\t';
			const lineSeparator = document.eol === vscode.EndOfLine.CRLF ? '\r\n' : '\n';

			try {
				const formatted = formatXml(source, {
					indentation,
					lineSeparator,
					collapseContent: true,
					strictMode: true,
				});

				if (formatted === source) {
					return [];
				}

				const fullDocumentRange = new vscode.Range(
					document.positionAt(0),
					document.positionAt(source.length),
				);
				return [vscode.TextEdit.replace(fullDocumentRange, formatted)];
			} catch (error) {
				const message = error instanceof Error ? error.message : String(error);
				void vscode.window.showErrorMessage(`Unable to format XML: ${message}`);
				return [];
			}
		},
	});
}
