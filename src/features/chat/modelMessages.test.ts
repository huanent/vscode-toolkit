import { describe, expect, it, vi } from 'vitest';
import { createUserMessage } from './modelMessages';

vi.mock('vscode', () => ({
    LanguageModelTextPart: class { constructor(public value: string) { } },
    LanguageModelDataPart: { image: (data: Uint8Array, mimeType: string) => ({ data, mimeType }) },
    LanguageModelChatMessage: { User: (content: unknown) => ({ content }) },
}));

describe('chat model attachments', () => {
    it('preserves text files and sends images as binary data parts', () => {
        const message = createUserMessage({
            content: 'Review', attachments: [
                { id: 'text', name: 'code.ts', mimeType: 'text/plain', data: 'const value = 1;' },
                { id: 'image', name: 'photo.png', mimeType: 'image/png', data: 'aGVsbG8=' },
            ]
        });
        expect(message.content).toEqual([
            { value: 'Review' }, { value: 'Attached file: "code.ts"' }, { value: 'const value = 1;' },
            { value: 'Attached file: "photo.png"' }, { data: Buffer.from('hello'), mimeType: 'image/png' },
        ]);
    });
    it('accepts attachment-only messages and legacy text', () => {
        expect(createUserMessage({
            content: '', attachments: [
                { id: 'text', name: 'empty.txt', mimeType: 'text/plain', data: '' },
            ]
        }).content).toHaveLength(2);
        expect(createUserMessage({ content: 'Hello' }).content).toEqual([{ value: 'Hello' }]);
    });
});