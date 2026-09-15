import { IconButton as SharedIconButton } from '@webview/components/ui/button';
import type { ButtonHTMLAttributes } from 'react';

interface IconButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
	icon: string;
	active?: boolean;
}

export function IconButton({ icon, active = false, className, type = 'button', title, ...props }: IconButtonProps) {
	return (
		<SharedIconButton
			{...props}
			icon={<i className={`codicon ${icon}`} aria-hidden="true" />}
			label={props['aria-label'] ?? title ?? icon.replace('codicon-', '')}
			title={title}
			htmlType={type}
			active={active}
			className={className}
		/>
	);
}
