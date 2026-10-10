import { cn } from 'cn';
import type { HTMLAttributes } from 'react';

export function Codicon({
	name,
	size = 16,
	className = '',
	style,
	...props
}: { name: string; size?: number; className?: string } & HTMLAttributes<HTMLSpanElement>) {
	return (
		<span
			aria-hidden="true"
			className={cn('codicon', `codicon-${name}`, className)}
			style={{ fontSize: size, ...style }}
			{...props}
		/>
	);
}
