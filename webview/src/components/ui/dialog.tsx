import { cn } from 'cn';
import { useEffect, useId, useRef, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { IconButton } from './button';
import { X } from './icons';

export type DialogProps = {
	open: boolean;
	onClose(): void;
	title: ReactNode;
	description?: ReactNode;
	children: ReactNode;
	actions?: ReactNode;
	size?: 'md' | 'lg';
	closeDisabled?: boolean;
	closeOnBackdrop?: boolean;
	className?: string;
};

export function Dialog({ open, onClose, title, description, children, actions, size = 'md', closeDisabled = false, closeOnBackdrop = true, className }: DialogProps) {
	const dialogRef = useRef<HTMLDialogElement>(null);
	const titleId = useId();
	const descriptionId = useId();

	useEffect(() => {
		const dialog = dialogRef.current;
		if (!dialog || !open) return;
		dialog.showModal();
		return () => dialog.close();
	}, [open]);

	return createPortal(
		<dialog
			ref={dialogRef}
			aria-labelledby={titleId}
			aria-describedby={description ? descriptionId : undefined}
			className={cn('fixed inset-0 m-auto max-h-[calc(100dvh-32px)] w-[calc(100%-32px)] overflow-hidden rounded-lg border border-(--vscode-widget-border,var(--vscode-panel-border)) bg-(--vscode-editor-background) p-0 text-(--vscode-foreground) backdrop:bg-black/45', size === 'lg' ? 'max-w-245' : 'max-w-180', className)}
			onCancel={event => {
				event.preventDefault();
				event.stopPropagation();
				if (!closeDisabled) onClose();
			}}
			onClick={event => {
				if (event.target !== event.currentTarget || closeDisabled || !closeOnBackdrop) return;
				const bounds = event.currentTarget.getBoundingClientRect();
				if (event.clientX < bounds.left || event.clientX > bounds.right || event.clientY < bounds.top || event.clientY > bounds.bottom) onClose();
			}}
		>
			{open && <div className="flex max-h-[calc(100dvh-34px)] min-h-0 flex-col">
				<header className="flex shrink-0 items-start gap-3 border-b border-(--vscode-panel-border) px-4 py-3">
					<div className="min-w-0 flex-1">
						<h2 id={titleId} className="m-0 text-base font-semibold wrap-anywhere">{title}</h2>
						{description && <p id={descriptionId} className="mt-1 mb-0 text-sm wrap-anywhere text-(--vscode-descriptionForeground)">{description}</p>}
					</div>
					<IconButton icon={<X />} label="Close" disabled={closeDisabled} onClick={onClose} />
				</header>
				<div className="min-h-0 overflow-auto p-4">{children}</div>
				{actions && <footer className="flex shrink-0 flex-wrap justify-end gap-2 border-t border-(--vscode-panel-border) px-4 py-3">{actions}</footer>}
			</div>}
		</dialog>,
		document.body,
	);
}