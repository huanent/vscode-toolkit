import * as vscode from 'vscode';

interface WebviewHtmlOptions {
	entry: string;
	styleEntry?: string;
	additionalStyleEntries?: string[];
	title: string;
	rootData?: Record<string, string>;
	allowImages?: boolean;
	useStyleNonce?: boolean;
	allowInlineStyleAttributes?: boolean;
}

export function getWebviewHtml(
	webview: vscode.Webview,
	extensionUri: vscode.Uri,
	options: WebviewHtmlOptions,
): string {
	const nonce = getNonce();
	const styleEntry = options.styleEntry ?? options.entry;
	const styleUri = webview.asWebviewUri(
		vscode.Uri.joinPath(extensionUri, 'media', `${styleEntry}.css`),
	);
	const scriptUri = webview.asWebviewUri(
		vscode.Uri.joinPath(extensionUri, 'media', `${options.entry}.js`),
	);
	const imagePolicy = options.allowImages ? ` img-src ${webview.cspSource} https: data:;` : '';
	const stylePolicy = options.useStyleNonce
		? `style-src ${webview.cspSource} 'nonce-${nonce}';`
		: `style-src ${webview.cspSource} 'unsafe-inline';`;
	const styleAttributePolicy = options.allowInlineStyleAttributes
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
        <meta http-equiv="Content-Security-Policy" content="default-src 'none';${imagePolicy} font-src ${webview.cspSource}; ${stylePolicy}${styleAttributePolicy} script-src ${webview.cspSource} 'nonce-${nonce}';">
        <link rel="stylesheet" href="${styleUri}">
		${(options.additionalStyleEntries ?? []).map(entry => `<link rel="stylesheet" href="${webview.asWebviewUri(vscode.Uri.joinPath(extensionUri, 'media', `${entry}.css`))}">`).join('\n')}
        <title>${escapeHtml(options.title)}</title>
</head>
<body>
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
