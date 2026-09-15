import * as vscode from 'vscode';
import { validateAttachments } from './attachments';
import type { StoredMessage } from './session';

export function createUserMessage(message: Pick<StoredMessage, 'content' | 'attachments'>): vscode.LanguageModelChatMessage {
	const parts: Array<vscode.LanguageModelTextPart | vscode.LanguageModelDataPart> = [];
	if (message.content) parts.push(new vscode.LanguageModelTextPart(message.content));
	for (const attachment of validateAttachments(message.attachments)) {
		parts.push(new vscode.LanguageModelTextPart(`Attached file: ${JSON.stringify(attachment.name)}`));
		parts.push(attachment.mimeType === 'text/plain'
			? new vscode.LanguageModelTextPart(attachment.data)
			: vscode.LanguageModelDataPart.image(Buffer.from(attachment.data, 'base64'), attachment.mimeType));
	}
	return vscode.LanguageModelChatMessage.User(parts);
}