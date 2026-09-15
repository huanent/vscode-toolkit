import { describe, expect, it } from 'vitest';
import { maxAttachmentBytes, validateAttachments } from './attachments';

describe('chat attachments', () => {
    const file = { id: 'file', name: 'example.ts', mimeType: 'text/plain', data: 'export const value = 1;' };
    it('accepts text, images and legacy messages without attachments', () => {
        expect(validateAttachments(undefined)).toEqual([]);
        expect(validateAttachments([file])).toEqual([file]);
        expect(validateAttachments([{ ...file, mimeType: 'image/png', data: 'aGVsbG8=' }])).toHaveLength(1);
    });
    it('rejects unsupported formats and malformed images', () => {
        expect(() => validateAttachments([{ ...file, mimeType: 'application/pdf' }])).toThrow();
        expect(() => validateAttachments([{ ...file, mimeType: 'image/png', data: 'not base64' }])).toThrow();
    });
    it('rejects duplicate IDs and excessive attachment counts', () => {
        expect(() => validateAttachments([file, file])).toThrow();
        expect(() => validateAttachments(Array.from({ length: 11 }, (_, index) => ({ ...file, id: String(index) })))).toThrow();
    });
    it('enforces the UTF-8 byte limit', () => {
        expect(() => validateAttachments([{ ...file, data: 'a'.repeat(maxAttachmentBytes + 1) }])).toThrow();
        expect(() => validateAttachments([{ ...file, data: '\u00e9'.repeat(maxAttachmentBytes / 2 + 1) }])).toThrow();
    });
});