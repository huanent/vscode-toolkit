import { cn } from 'cn';
import { lazy, Suspense } from 'react';
import { Loading } from '../../../components/ui/loading';

const MarkdownContent = lazy(() =>
	import('./markdownContent').then(module => ({ default: module.MarkdownContent })),
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
			<Loading variant="icon" label="Waiting for response" className="h-6 px-1" />
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
