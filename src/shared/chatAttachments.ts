export type ChatAttachment = {
    id: string;
    name: string;
    mimeType: string;
    data: string;
};

export const maxAttachmentBytes = 5 * 1024 * 1024;
export const maxAttachments = 10;
export const imageMimeTypes = ['image/png', 'image/jpeg', 'image/gif', 'image/webp'];

export function validateAttachments(value: unknown): ChatAttachment[] {
    if (value === undefined) return [];
    if (!Array.isArray(value) || value.length > maxAttachments) {
        throw new Error(`A message can contain at most ${maxAttachments} attachments.`);
    }
    const ids = new Set<string>();
    for (const attachment of value) {
        if (!attachment || typeof attachment !== 'object' ||
            typeof attachment.id !== 'string' || !attachment.id || ids.has(attachment.id) ||
            typeof attachment.name !== 'string' || !attachment.name || attachment.name.length > 255 ||
            typeof attachment.data !== 'string' ||
            !(attachment.mimeType === 'text/plain' || imageMimeTypes.includes(attachment.mimeType))) {
            throw new Error('Invalid chat attachment.');
        }
        ids.add(attachment.id);
        if (attachment.mimeType === 'text/plain') {
            if (new TextEncoder().encode(attachment.data).byteLength > maxAttachmentBytes) {
                throw new Error('Each attachment must be 5 MB or smaller.');
            }
        } else {
            if (!attachment.data || attachment.data.length > Math.ceil(maxAttachmentBytes / 3) * 4 ||
                attachment.data.length % 4 !== 0 || !/^[A-Za-z0-9+/]*={0,2}$/.test(attachment.data)) {
                throw new Error('Invalid or oversized image attachment.');
            }
            const padding = attachment.data.endsWith('==') ? 2 : attachment.data.endsWith('=') ? 1 : 0;
            if (attachment.data.length / 4 * 3 - padding > maxAttachmentBytes) {
                throw new Error('Each attachment must be 5 MB or smaller.');
            }
        }
    }
    return value;
}