import * as vscode from 'vscode';
import { requestLinePattern, variablePattern } from './httpLanguageService';

const separatorPattern = /^\s*###(?:\s+(.*?))?\s*$/;

export function registerHttpFormatter(): vscode.Disposable {
	return vscode.languages.registerDocumentFormattingEditProvider('http', {
		provideDocumentFormattingEdits(document, options) {
			const source = document.getText();
			const indentation = options.insertSpaces ? ' '.repeat(options.tabSize) : '\t';
			const lineEnding = document.eol === vscode.EndOfLine.CRLF ? '\r\n' : '\n';
			const formatted = formatHttp(source, indentation, lineEnding);
			if (formatted === source) {
				return [];
			}

			return [
				vscode.TextEdit.replace(
					new vscode.Range(document.positionAt(0), document.positionAt(source.length)),
					formatted,
				),
			];
		},
	});
}

export function formatHttp(source: string, indentation = '  ', lineEnding = '\n'): string {
	const hadFinalLineEnding = /\r?\n$/.test(source);
	const lines = source.replace(/\r\n/g, '\n').split('\n');
	if (hadFinalLineEnding) {
		lines.pop();
	}

	const sections: string[][] = [];
	let section: string[] = [];
	for (const line of lines) {
		if (separatorPattern.test(line) && section.length > 0) {
			sections.push(section);
			section = [line];
		} else {
			section.push(line);
		}
	}
	sections.push(section);

	const formattedSections = sections.map(linesInSection =>
		formatSection(linesInSection, indentation),
	);
	const output: string[] = [];
	for (const formattedSection of formattedSections) {
		if (formattedSection.length === 0) {
			continue;
		}
		if (output.length > 0 && output.at(-1) !== '') {
			output.push('');
		}
		output.push(...formattedSection);
	}

	return output.join(lineEnding) + (hadFinalLineEnding ? lineEnding : '');
}

function formatSection(lines: string[], indentation: string): string[] {
	const output = [...lines];
	if (output.length === 0) {
		return output;
	}

	const separator = separatorPattern.exec(output[0]);
	if (separator) {
		output[0] = separator[1] ? `### ${separator[1].trim()}` : '###';
	}

	let requestLine = -1;
	for (let index = 0; index < output.length; index++) {
		output[index] = output[index].trimEnd();
		const variable = variablePattern.exec(output[index]);
		if (variable) {
			output[index] = `@${variable[1]} = ${variable[2]}`;
		}

		const request = requestLinePattern.exec(output[index]);
		if (request) {
			requestLine = index;
			output[index] =
				`${request[1].toUpperCase()} ${request[2]}${request[3] ? ` ${request[3].toUpperCase()}` : ''}`;
			break;
		}
	}

	if (requestLine < 0) {
		return trimBlankEdges(output);
	}

	let bodyStart = -1;
	for (let index = requestLine + 1; index < output.length; index++) {
		const line = output[index];
		if (line.trim() === '') {
			bodyStart = index + 1;
			break;
		}
		if (/^\s*(?:#|\/\/)/.test(line)) {
			output[index] = line.trimStart();
			continue;
		}

		const colon = line.indexOf(':');
		if (colon < 1) {
			continue;
		}
		const name = line.slice(0, colon).trim();
		const value = line.slice(colon + 1).trim();
		output[index] = `${name}: ${value}`;
	}

	if (bodyStart >= 0) {
		let contentStart = bodyStart;
		let contentEnd = output.length;
		const isCommentOrBlank = (line: string): boolean => /^\s*(?:(?:#|\/\/).*)?$/.test(line);
		while (contentStart < contentEnd && isCommentOrBlank(output[contentStart])) {
			contentStart++;
		}
		while (contentEnd > contentStart && isCommentOrBlank(output[contentEnd - 1])) {
			contentEnd--;
		}
		const body = output.slice(contentStart, contentEnd).join('\n').trim();
		if (body) {
			try {
				const formattedBody = JSON.stringify(JSON.parse(body), null, indentation).split('\n');
				output.splice(contentStart, contentEnd - contentStart, ...formattedBody);
			} catch {}
		}
		return output;
	}

	return trimBlankEdges(output);
}

function trimBlankEdges(lines: string[]): string[] {
	let start = 0;
	let end = lines.length;
	while (start < end && lines[start].trim() === '') {
		start++;
	}
	while (end > start && lines[end - 1].trim() === '') {
		end--;
	}
	return lines.slice(start, end);
}
