import { Dialog as BaseDialog } from '@base-ui/react/dialog';
import { Dialog as SourceDialog } from '@/webview/components/dialog';
import type { ReactNode } from 'react';

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

export function Dialog({
	open,
	onClose,
	title,
	description,
	children,
	actions,
	size = 'md',
	closeDisabled = false,
	closeOnBackdrop = true,
	className,
}: DialogProps) {
	return (
		<SourceDialog
			open={open}
			onOpenChange={nextOpen => {
				if (!nextOpen && !closeDisabled) onClose();
			}}
			title={title}
			description={description}
			footer={actions}
			size={size}
			closeDisabled={closeDisabled}
			closeOnBackdrop={closeOnBackdrop}
			className={className}
		>
			{children}
		</SourceDialog>
	);
}

export { BaseDialog };