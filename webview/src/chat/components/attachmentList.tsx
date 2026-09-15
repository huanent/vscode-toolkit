import { FileText, X } from '../../components/ui/icons';
import { IconButton } from '../../components/ui/button';
import type { ChatAttachment } from '../types';
import { cn } from 'cn';
import { useState } from 'react';
import { Dialog } from '../../components/ui/dialog';

type AttachmentListProps = {
    attachments?: ChatAttachment[];
    disabled?: boolean;
    onRemove?(id: string): void;
};

export function AttachmentList({ attachments, disabled, onRemove }: AttachmentListProps) {
    const [previewId, setPreviewId] = useState<string>();
    const preview = attachments?.find(attachment => attachment.id === previewId);
    if (!attachments?.length) return null;
    return (
        <>
            <ul className={cn('flex max-w-full flex-wrap gap-2', onRemove ? 'p-2' : 'justify-end py-2')} aria-label="Attachments">
                {attachments.map(attachment => (
                    <li key={attachment.id} className={cn(
                        'flex min-w-0 max-w-full items-center border border-(--vscode-panel-border)',
                        onRemove ? 'h-7 gap-1 rounded-sm pr-1.5' : 'gap-2 rounded-md p-2',
                    )}>
                        {onRemove && <IconButton label={`Remove ${attachment.name}`} icon={<X />} size="sm" disabled={disabled} onClick={() => onRemove(attachment.id)} />}
                        {attachment.mimeType.startsWith('image/') ? (
                            <button
                                type="button"
                                aria-label={`Preview ${attachment.name}`}
                                title={`Preview ${attachment.name}`}
                                className="shrink-0 cursor-zoom-in rounded-xs border-0 bg-transparent p-0 focus-visible:outline-1 focus-visible:outline-offset-2 focus-visible:outline-(--vscode-focusBorder)"
                                onClick={() => setPreviewId(attachment.id)}
                            >
                                <img src={`data:${attachment.mimeType};base64,${attachment.data}`} alt={attachment.name} className={cn('block rounded-xs object-contain', onRemove ? 'h-4 w-5' : 'h-16 w-20')} />
                            </button>
                        ) : <FileText size={onRemove ? 'sm' : 'lg'} className="shrink-0" />}
                        <span className="min-w-0 max-w-48 truncate text-sm" title={attachment.name}>{attachment.name}</span>
                    </li>
                ))}
            </ul>
            <Dialog open={Boolean(preview)} onClose={() => setPreviewId(undefined)} title={preview?.name ?? 'Image preview'} size="lg">
                {preview && <img
                    src={`data:${preview.mimeType};base64,${preview.data}`}
                    alt={preview.name}
                    className="mx-auto block h-auto max-h-[calc(100dvh-160px)] max-w-full object-contain"
                />}
            </Dialog>
        </>
    );
}