import { cn } from 'cn';
import type { ComponentPropsWithRef, ReactNode } from 'react';

export type EmptyProps = Omit<ComponentPropsWithRef<'div'>, 'title' | 'children'> & {
	icon?: ReactNode;
	title: ReactNode;
	titleAs?: 'h1' | 'h2' | 'h3' | 'strong';
	description?: ReactNode;
	titleClassName?: string;
	descriptionClassName?: string;
};

export function Empty({
	icon,
	title,
	titleAs: Title = 'strong',
	description,
	className,
	titleClassName,
	descriptionClassName,
	...props
}: EmptyProps) {
	return (
		<div
			className={cn(
				'grid min-w-0 place-content-center justify-items-center gap-2 p-4 text-center text-sm text-(--vscode-descriptionForeground)',
				className,
			)}
			{...props}
		>
			{icon}
			<Title className={cn('m-0 max-w-full text-sm font-medium wrap-anywhere text-(--vscode-foreground)', titleClassName)}>
				{title}
			</Title>
			{description != null && (
				<div className={cn('max-w-full text-xs wrap-anywhere', descriptionClassName)}>
					{description}
				</div>
			)}
		</div>
	);
}