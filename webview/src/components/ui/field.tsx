import type { ReactNode } from 'react';

export function FieldLabel({ children, hint }: { children: ReactNode; hint?: ReactNode }) {
	return (
		<span className="mb-1.5 flex items-baseline justify-between gap-2 text-xs font-medium">
			{children}
			{hint && (
				<small className="shrink-0 font-normal text-(--vscode-descriptionForeground)">{hint}</small>
			)}
		</span>
	);
}
