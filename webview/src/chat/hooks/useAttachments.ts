import { useRef, useState } from 'react';
import { imageMimeTypes, maxAttachmentBytes, maxAttachments, validateAttachments } from '../../../../src/chat/attachments';
import type { ChatAttachment } from '../types';

export function useAttachments() {
    const [attachments, setAttachments] = useState<ChatAttachment[]>([]);
    const [attachmentError, setAttachmentError] = useState('');
    const [readingAttachments, setReadingAttachments] = useState(false);
    const attachmentsRef = useRef(attachments);
    const versionRef = useRef(0);
    const readingRef = useRef(false);

    const replaceAttachments = (next: ChatAttachment[] = []) => {
        versionRef.current++;
        attachmentsRef.current = next;
        setAttachments(next);
        setAttachmentError('');
        readingRef.current = false;
        setReadingAttachments(false);
    };

    const addAttachments = async (files: File[]) => {
        if (!files.length || readingRef.current) return;
        const version = versionRef.current;
        readingRef.current = true;
        setReadingAttachments(true);
        setAttachmentError('');
        try {
            if (files.length + attachmentsRef.current.length > maxAttachments) throw new Error(`A message can contain at most ${maxAttachments} attachments.`);
            const added = await Promise.all(files.map(readAttachment));
            if (version !== versionRef.current) return;
            const next = validateAttachments([...attachmentsRef.current, ...added]);
            attachmentsRef.current = next;
            setAttachments(next);
        } catch (error) {
            if (version === versionRef.current) setAttachmentError(error instanceof Error ? error.message : String(error));
        } finally {
            if (version === versionRef.current) {
                readingRef.current = false;
                setReadingAttachments(false);
            }
        }
    };

    return {
        attachments, attachmentError, readingAttachments, addAttachments, replaceAttachments,
        removeAttachment: (id: string) => replaceAttachments(attachmentsRef.current.filter(item => item.id !== id)),
    };
}

async function readAttachment(file: File): Promise<ChatAttachment> {
    if (file.size > maxAttachmentBytes) throw new Error(`${file.name}: each attachment must be 5 MB or smaller.`);
    const bytes = new Uint8Array(await file.arrayBuffer());
    const extension = file.name.split('.').pop()?.toLowerCase();
    const imageTypes: Record<string, string> = { png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', gif: 'image/gif', webp: 'image/webp' };
    const mimeType = imageTypes[extension ?? ''] ?? file.type;
    let data: string;
    if (imageMimeTypes.includes(mimeType)) {
        let binary = '';
        for (let offset = 0; offset < bytes.length; offset += 8192) {
            binary += String.fromCharCode(...bytes.subarray(offset, offset + 8192));
        }
        data = btoa(binary);
    } else {
        try {
            data = new TextDecoder('utf-8', { fatal: true }).decode(bytes);
            if (bytes.some(byte => byte < 9 || (byte > 13 && byte < 32)) || file.type.startsWith('image/') ||
                ['pdf', 'zip', 'doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx'].includes(extension ?? '')) throw new Error();
        } catch {
            throw new Error(`${file.name}: only UTF-8 text files and PNG, JPEG, GIF or WebP images are supported.`);
        }
    }
    return { id: crypto.randomUUID(), name: file.name, mimeType: imageMimeTypes.includes(mimeType) ? mimeType : 'text/plain', data };
}