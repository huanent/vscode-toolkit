import type { ChatDocument } from '@/features/chat/protocol';

export function formatChatAsMarkdown(chat: ChatDocument, modelLabel?: string): string {
  const lines = [`# ${chat.title?.trim() || 'Chat'}`, ''];

  const details = [modelLabel && `Model: ${modelLabel}`];
  const createdAt = Number(chat.id);
  if (Number.isFinite(createdAt)) details.push(`Date: ${new Date(createdAt).toLocaleString()}`);
  const summary = details.filter((detail) => !!detail).join(' · ');
  if (summary) lines.push(`> ${summary}`, '');

  for (const message of chat.messages) {
    const content = message.content.trim();
    if (!content) continue;
    lines.push(message.role === 'user' ? '## You' : '## Assistant', '', content, '');
  }

  return `${lines.join('\n').trimEnd()}\n`;
}
