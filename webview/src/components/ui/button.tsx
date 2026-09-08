import { cn } from 'cn';
import type { ButtonHTMLAttributes } from 'react';

export function SecondaryButton({ className, ...props }: ButtonHTMLAttributes<HTMLButtonElement>) {
	return (
		<button
			className={cn(
				'inline-flex h-8 items-center justify-center gap-1.5 rounded-[2px] border border-(--vscode-button-border,transparent) bg-(--vscode-button-secondaryBackground) px-3 text-xs font-semibold text-(--vscode-button-secondaryForeground) hover:bg-(--vscode-button-secondaryHoverBackground) disabled:cursor-default disabled:opacity-45',
				className,
			)}
			{...props}
		/>
	);
}

export function IconButton({ className = '', ...props }: ButtonHTMLAttributes<HTMLButtonElement>) {
	return (
		<button
			className={cn(
				'grid size-8 shrink-0 place-items-center rounded-[2px] border border-transparent bg-transparent text-(--vscode-icon-foreground) transition-colors duration-100 hover:bg-(--vscode-toolbar-hoverBackground) active:bg-(--vscode-toolbar-activeBackground,var(--vscode-toolbar-hoverBackground)) disabled:cursor-default disabled:opacity-45',
				className,
			)}
			{...props}
		/>
	);
}

export function PrimaryButton({
	className = '',
	...props
}: ButtonHTMLAttributes<HTMLButtonElement>) {
	return (
		<button
			className={cn(
				'inline-flex h-8 items-center justify-center gap-1.5 rounded-[2px] border border-(--vscode-button-border,transparent) bg-(--vscode-button-background) px-3 text-xs font-semibold text-(--vscode-button-foreground) transition-colors duration-100 hover:bg-(--vscode-button-hoverBackground) active:brightness-95 disabled:cursor-default disabled:opacity-45',
				className,
			)}
			{...props}
		/>
	);
}
