import { Square, Send } from '../../../components/icons';
import { cn } from 'cn';
import type { RefObject } from 'react';
import type { ModelItem } from '../types';
import { ModelPicker } from './modelPicker';
import { IconButton } from '../../../components/button';

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
}: ChatInputProps) {
	return (
		<section className="w-[calc(100%-40px)] max-w-210 justify-self-center bg-(--vscode-editor-background) pt-2 pb-3 max-[620px]:w-[calc(100%-24px)]">
			<div
				className={cn(
					'relative rounded-lg border bg-(--vscode-input-background) transition-colors duration-75 focus-within:border-(--vscode-focusBorder)',
					editingIndex !== undefined
						? 'border-(--vscode-focusBorder) shadow-[0_0_0_1px_var(--vscode-focusBorder)]'
						: 'border-(--vscode-panel-border)',
				)}
			>
				<div
					ref={inputRef}
					className="message-input min-h-11 max-h-45 w-full overflow-y-auto px-4 pt-3 pb-2 text-sm text-(--vscode-input-foreground) outline-none whitespace-pre-wrap wrap-anywhere data-[disabled=true]:opacity-60"
					role="textbox"
					aria-label="Message"
					aria-multiline="true"
					contentEditable={busy ? false : 'plaintext-only'}
					data-disabled={busy}
					data-placeholder="What shall we explore together?"
					autoFocus
					onInput={event => onInputChange(event.currentTarget.textContent ?? '')}
					onKeyDown={event => {
						if (event.key === 'Enter' && !event.shiftKey && !event.nativeEvent.isComposing) {
							event.preventDefault();
							onSend();
						}
					}}
				/>
				<div className="flex min-h-10 flex-wrap items-end gap-2 px-2 pt-2 pb-2">
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
						disabled={!busy && (!input.trim() || !selectedModelId)}
						onClick={onSend}
					/>
				</div>
			</div>
		</section>
	);
}
