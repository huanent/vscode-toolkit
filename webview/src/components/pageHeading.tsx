import { cn } from 'cn';
import type { ReactNode } from 'react';

export function PageHeading({
	icon,
	title,
	description,
	accentClassName,
	actions,
}: {
	icon: ReactNode;
	title: string;
	description: string;
	accentClassName: string;
	actions?: ReactNode;
}) {
	return (
		<header className="mb-4 flex min-h-12 flex-wrap items-center justify-between gap-4 max-[760px]:items-start">
			<div className="flex min-w-0 items-center gap-3">
				<div
					className={cn(
						'grid size-9 shrink-0 place-items-center rounded-sm bg-(--vscode-editorWidget-background) ring-1 ring-(--vscode-panel-border)',
						accentClassName,
					)}
				>
					{icon}
				</div>
				<div className="min-w-0">
					<h1 className="m-0 text-xl font-semibold wrap-anywhere">{title}</h1>
					<p className="mt-1 mb-0 text-xs text-(--vscode-descriptionForeground) max-[760px]:hidden">
						{description}
					</p>
				</div>
			</div>
			{actions}
		</header>
	);
}
