import { Square, Send, Plus } from '../../components/ui/icons';
import { cn } from 'cn';
import { useRef, type RefObject } from 'react';
import type { ChatAttachment, ModelItem } from '../types';
import { AttachmentList } from './attachmentList';
import { ModelPicker } from './modelPicker';
import { IconButton } from '../../components/ui/button';

type ChatInputProps = {
	inputRef: RefObject<HTMLDivElement | null>;
	input: string;
	busy: boolean;
	editingIndex?: number;
	models: ModelItem[];
	selectedModelId: string;
	modelsError: boolean;
	onInputChange(value: string): void;
	onSelectModel(modelId: string): void;
	onSend(): void;
	attachments: ChatAttachment[];
	attachmentError: string;
	readingAttachments: boolean;
	onAddAttachments(files: File[]): void;
	onRemoveAttachment(id: string): void;
};

export function ChatInput({
	inputRef,
	input,
	busy,
	editingIndex,
	models,
	selectedModelId,
	modelsError,
	onInputChange,
	onSelectModel,
	onSend,
	attachments,
	attachmentError,
	readingAttachments,
	onAddAttachments,
	onRemoveAttachment,
}: ChatInputProps) {
	const fileInputRef = useRef<HTMLInputElement>(null);
	return (
		<section className="w-[calc(100%-40px)] max-w-210 justify-self-center bg-(--vscode-editor-background) pt-2 pb-3 max-[620px]:w-[calc(100%-24px)]">
			<div
				onDragOver={event => {
					if (event.dataTransfer.types.includes('Files')) event.preventDefault();
				}}
				onDrop={event => {
					if (!event.dataTransfer.types.includes('Files')) return;
					event.preventDefault();
					if (!busy && !readingAttachments) onAddAttachments(Array.from(event.dataTransfer.files));
				}}
				className={cn(
					'relative rounded-lg border bg-(--vscode-input-background) transition-colors duration-75 focus-within:border-(--vscode-focusBorder)',
					editingIndex !== undefined
						? 'border-(--vscode-focusBorder) shadow-[0_0_0_1px_var(--vscode-focusBorder)]'
						: 'border-(--vscode-panel-border)',
				)}
			>
				<AttachmentList attachments={attachments} disabled={busy || readingAttachments} onRemove={onRemoveAttachment} />
				<input ref={fileInputRef} type="file" multiple hidden aria-label="Attach files" disabled={busy || readingAttachments} onChange={event => {
					onAddAttachments(Array.from(event.currentTarget.files ?? []));
					event.currentTarget.value = '';
				}} />
				<div
					ref={inputRef}
					className="message-input min-h-9 max-h-45 w-full overflow-y-auto px-4 pt-3 pb-1 text-md text-(--vscode-input-foreground) outline-none whitespace-pre-wrap wrap-anywhere data-[disabled=true]:opacity-60"
					role="textbox"
					aria-label="Message"
					aria-multiline="true"
					contentEditable={busy ? false : 'plaintext-only'}
					data-disabled={busy}
					data-placeholder="What shall we explore together?"
					autoFocus
					onInput={event => onInputChange(event.currentTarget.textContent ?? '')}
					onPaste={event => {
						const files = Array.from(event.clipboardData.files);
						if (!files.length) return;
						event.preventDefault();
						if (!busy && !readingAttachments) onAddAttachments(files);
					}}
					onKeyDown={event => {
						if (event.key === 'Enter' && !event.shiftKey && !event.nativeEvent.isComposing) {
							event.preventDefault();
							onSend();
						}
					}}
				/>
				<div className="flex min-h-10 flex-wrap items-end gap-1 px-2 pb-2">
					<IconButton label="Attach images or files" icon={<Plus size='sm' />} size="sm" disabled={busy || readingAttachments} onClick={() => fileInputRef.current?.click()} />
					<ModelPicker
						models={models}
						selectedModelId={selectedModelId}
						disabled={busy}
						error={modelsError}
						onSelect={onSelectModel}
					/>
					<span className="flex-1" />
					<IconButton
						label={busy ? 'Stop generating' : 'Send'}
						icon={
							busy ? (
								<Square size="sm" />
							) : (
								<Send size="sm" />
							)
						}
						size="md"
						disabled={!busy && ((!input.trim() && !attachments.length) || !selectedModelId || readingAttachments)}
						onClick={onSend}
					/>
				</div>
			</div>
			{readingAttachments && <div role="status" className="px-2 pt-1 text-sm text-(--vscode-descriptionForeground)">Reading attachments...</div>}
			{attachmentError && <div role="alert" className="px-2 pt-1 text-sm text-(--vscode-errorForeground)">{attachmentError}</div>}
		</section>
	);
}
