import { Pencil, RefreshCw, CircleCheck, Copy } from '../../../../components/icons';
import type { StoredMessage } from '../../types';
import { IconButton } from '../../../../components/button';

type MessageActionsProps = {
	message: StoredMessage;
	busy: boolean;
	copied: boolean;
	onEdit(): void;
	onRegenerate(): void;
	onCopy(): void;
};

export function MessageActions({
	message,
	busy,
	copied,
	onEdit,
	onRegenerate,
	onCopy,
}: MessageActionsProps) {
	return (
		<>
			{message.role === 'user' && (
				<IconButton
					label="Edit message"
					icon={
						<Pencil size="sm" />
					}
					size="sm"
					disabled={busy}
					onClick={onEdit}
				/>
			)}
			{message.role === 'assistant' && (
				<IconButton
					label="Regenerate response"
					icon={
						<RefreshCw size="sm" />
					}
					size="sm"
					disabled={busy}
					onClick={onRegenerate}
				/>
			)}
			<IconButton
				label={copied ? 'Copied' : 'Copy message'}
				icon={
					copied ? (
						<CircleCheck size="sm" />
					) : (
						<Copy size="sm" />
					)
				}
				size="sm"
				onClick={onCopy}
			/>
		</>
	);
}
