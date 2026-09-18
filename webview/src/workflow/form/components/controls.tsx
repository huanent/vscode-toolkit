import { cloneElement, isValidElement, type ReactElement, type ReactNode } from 'react';
import { IconButton as SharedIconButton } from '@webview/components/ui/button';
import { Field as SharedField, type FieldControlProps } from '@webview/components/ui/field';

export const buttonClass =
	'inline-flex h-8 shrink-0 items-center justify-center gap-2 rounded-xs px-2 text-xs hover:bg-(--vscode-toolbar-hoverBackground) focus-visible:outline focus-visible:outline-(--vscode-focusBorder) disabled:opacity-40';
export function IconButton({
	title,
	children,
	onClick,
	disabled,
}: {
	title: string;
	children: ReactNode;
	onClick: () => void;
	disabled?: boolean;
}) {
	return (
		<SharedIconButton
			label={title}
			icon={children}
			onClick={onClick}
			disabled={disabled}
		/>
	);
}
export function Field({ label, children }: { label: string; children: ReactNode }) {
	return (
		<SharedField label={label}>{control => isValidElement(children)
			? cloneElement(children as ReactElement<Partial<FieldControlProps>>, control)
			: children}</SharedField>
	);
}
