import {
	autoUpdate,
	flip,
	FloatingFocusManager,
	FloatingPortal,
	offset,
	shift,
	useClick,
	useDismiss,
	useFloating,
	useInteractions,
	useRole,
	type Placement,
} from '@floating-ui/react';
import { cn } from 'cn';
import { useEffect, type ComponentPropsWithRef, type ReactNode } from 'react';

type PopoverProps = {
	open: boolean;
	onOpenChange(open: boolean): void;
	trigger(props: ComponentPropsWithRef<'button'>): ReactNode;
	children: ReactNode;
	label: string;
	placement?: Placement;
	role?: 'dialog' | 'listbox';
	disabled?: boolean;
	className?: string;
};

export function Popover({
	open,
	onOpenChange,
	trigger,
	children,
	label,
	placement = 'bottom-start',
	role = 'dialog',
	disabled = false,
	className,
}: PopoverProps) {
	const { refs, floatingStyles, context } = useFloating({
		open: open && !disabled,
		onOpenChange,
		placement,
		strategy: 'fixed',
		whileElementsMounted: autoUpdate,
		middleware: [offset(5), flip({ padding: 8 }), shift({ padding: 8 })],
	});
	const click = useClick(context, { enabled: !disabled });
	const dismiss = useDismiss(context, { bubbles: { escapeKey: false } });
	const semantics = useRole(context, { role });
	const { getReferenceProps, getFloatingProps } = useInteractions([click, dismiss, semantics]);

	useEffect(() => {
		if (disabled && open) onOpenChange(false);
	}, [disabled, open, onOpenChange]);

	useEffect(() => {
		if (!open) return;
		const close = () => onOpenChange(false);
		window.addEventListener('blur', close);
		return () => window.removeEventListener('blur', close);
	}, [open, onOpenChange]);

	return (
		<>
			{trigger({ ...getReferenceProps(), ref: refs.setReference, disabled })}
			{open && !disabled && (
				<FloatingPortal>
					<FloatingFocusManager context={context} modal={false}>
						<div
							ref={refs.setFloating}
							style={floatingStyles}
							className={cn(
								'z-120 max-h-[calc(100dvh-16px)] max-w-[calc(100vw-16px)] overflow-y-auto rounded-lg border border-(--vscode-widget-border,var(--vscode-panel-border)) bg-(--vscode-menu-background,var(--vscode-editorWidget-background)) text-(--vscode-menu-foreground,var(--vscode-foreground))',
								className,
							)}
							{...getFloatingProps({ 'aria-label': label })}
						>
							{children}
						</div>
					</FloatingFocusManager>
				</FloatingPortal>
			)}
		</>
	);
}
