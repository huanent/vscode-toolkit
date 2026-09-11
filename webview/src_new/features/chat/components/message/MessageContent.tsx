import { cn } from 'cn';
import { lazy, Suspense } from 'react';

const MarkdownContent = lazy(() =>
	import('../MarkdownContent').then(module => ({ default: module.MarkdownContent })),
);

type MessageContentProps = {
	content: string;
	isUser: boolean;
	isEditing: boolean;
	isLoading: boolean;
};

export function MessageContent({ content, isUser, isEditing, isLoading }: MessageContentProps) {
	if (isLoading) {
		return (
			<div className="flex h-6 items-center gap-1 px-1" role="status" aria-label="Waiting for response">
				{[0, 120, 240].map(delay => (
					<span key={delay} className="size-1 rounded-full bg-(--vscode-descriptionForeground) motion-safe:animate-bounce" style={{ animationDelay: `${delay}ms` }} />
				))}
			</div>
		);
	}
	return (
		<Suspense
			fallback={
				<div className="min-w-0 max-w-full whitespace-pre-wrap wrap-anywhere">{content}</div>
			}
		>
			<MarkdownContent
				text={content}
				className={cn(
					isUser &&
						'rounded-md border border-(--vscode-chat-requestBorder,var(--vscode-panel-border)) bg-(--vscode-chat-requestBackground,var(--vscode-input-background)) px-3 py-2',
					isEditing && 'border-(--vscode-focusBorder) shadow-[0_0_0_1px_var(--vscode-focusBorder)]',
				)}
			/>
		</Suspense>
	);
}
