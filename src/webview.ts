import * as vscode from 'vscode';

interface WebviewHtmlOptions {
	entry: string;
	styleEntry?: string;
	title: string;
	rootData?: Record<string, string>;
	stylePolicy?: 'external-only' | 'inline-attributes' | 'inline';
}

export function getWebviewHtml(
	webview: vscode.Webview,
	extensionUri: vscode.Uri,
	options: WebviewHtmlOptions,
): string {
	const nonce = getNonce();
	const styleEntry = options.styleEntry ?? 'styles';
	const styleUri = webview.asWebviewUri(
		vscode.Uri.joinPath(extensionUri, 'media', `${styleEntry}.css`),
	);
	const scriptUri = webview.asWebviewUri(
		vscode.Uri.joinPath(extensionUri, 'media', `${options.entry}.js`),
	);
	const stylePolicy = options.stylePolicy ?? 'inline';
	const styleSourcePolicy = stylePolicy === 'inline'
		? `style-src ${webview.cspSource} 'unsafe-inline';`
		: `style-src ${webview.cspSource};`;
	const styleAttributePolicy = stylePolicy === 'inline-attributes'
		? " style-src-attr 'unsafe-inline';"
		: '';
	const rootDataAttributes = Object.entries(options.rootData ?? {})
		.map(([name, value]) => ` data-${toKebabCase(name)}="${escapeHtml(value)}"`)
		.join('');

	return `<!DOCTYPE html>
<html lang="en">
<head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
		<meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src ${webview.cspSource} https: data:; font-src ${webview.cspSource}; ${styleSourcePolicy}${styleAttributePolicy} script-src ${webview.cspSource} 'nonce-${nonce}';">
		${styleEntry !== 'styles' ? `<link rel="stylesheet" href="${webview.asWebviewUri(vscode.Uri.joinPath(extensionUri, 'media', 'styles.css'))}">` : ''}
		<link rel="stylesheet" href="${styleUri}">
        <title>${escapeHtml(options.title)}</title>
</head>
<body data-webview="${escapeHtml(options.entry)}">
        <div id="root"${rootDataAttributes}></div>
        <script nonce="${nonce}" type="module" src="${scriptUri}"></script>
</body>
</html>`;
}

function toKebabCase(value: string): string {
	return value.replace(/[A-Z]/g, character => `-${character.toLowerCase()}`);
}

function escapeHtml(value: string): string {
	return value
		.replaceAll('&', '&amp;')
		.replaceAll('"', '&quot;')
		.replaceAll("'", '&#39;')
		.replaceAll('<', '&lt;')
		.replaceAll('>', '&gt;');
}

function getNonce(): string {
	const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
	let nonce = '';
	for (let index = 0; index < 32; index++) {
		nonce += characters.charAt(Math.floor(Math.random() * characters.length));
	}
	return nonce;
}
