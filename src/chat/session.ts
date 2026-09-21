import type { ChatAttachment } from './attachments';

export type TokenUsage = {
	input: number;
	output: number;
	cachedInput?: number;
};

export type StoredMessage = {
	role: 'user' | 'assistant';
	content: string;
	attachments?: ChatAttachment[];
	model?: string;
	tokenUsage?: TokenUsage;
};

export type StoredSession = {
	id: string;
	summary: string;
	updatedAt: number;
	messages: StoredMessage[];
};

export function createSummary(text: string) {
	const summary = text.replace(/\s+/g, ' ').trim();
	return summary.length > 60 ? `${summary.slice(0, 60)}…` : summary;
}

export function normalizeGeneratedSummary(text: string) {
	return text
		.replace(/^[#*`"'“‘]+/, '')
		.replace(/[#*`"'”’。.!！?？]+$/, '')
		.replace(/^title\s*:\s*/i, '')
		.replace(/\s+/g, ' ')
		.trim();
}

export function createTabTitle(text: string) {
	const summary = text.replace(/\s+/g, ' ').trim();
	return summary.length > 20 ? `${summary.slice(0, 20)}…` : summary;
}

export function getSessionSummary(session: StoredSession) {
	return createSummary(getSessionTitle(session));
}

export function getSessionTitle(session: StoredSession) {
	return session.summary.replace(/\s+/g, ' ').trim();
}
