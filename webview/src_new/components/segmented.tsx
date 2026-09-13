import { cn } from 'cn';
import { useId, type ReactNode } from 'react';

export type SegmentedOption<Value extends string> = {
	value: Value;
	label: ReactNode;
	disabled?: boolean;
};

export type SegmentedProps<Value extends string> = {
	label: string;
	value: Value;
	options: readonly SegmentedOption<Value>[];
	onChange(value: Value): void;
	disabled?: boolean;
	className?: string;
};

export function Segmented<Value extends string>({ label, value, options, onChange, disabled = false, className }: SegmentedProps<Value>) {
	const name = useId();
	return (
		<div role="radiogroup" aria-label={label} aria-disabled={disabled} className={cn('flex min-w-0 flex-wrap gap-1 rounded-sm border border-(--vscode-input-border,transparent) p-0.5', className)}>
			{options.map(option => (
				<label key={option.value} className="relative min-w-0 flex-1">
					<input
						className="peer sr-only"
						type="radio"
						name={name}
						value={option.value}
						checked={value === option.value}
						disabled={disabled || option.disabled}
						onChange={() => onChange(option.value)}
					/>
					<span className="flex min-h-8 items-center justify-center rounded-xs px-3 py-1 text-center text-sm wrap-anywhere text-(--vscode-foreground) peer-enabled:cursor-pointer peer-enabled:hover:bg-(--vscode-toolbar-hoverBackground) peer-checked:bg-(--vscode-inputOption-activeBackground)! peer-checked:text-(--vscode-inputOption-activeForeground) peer-focus-visible:outline-1 peer-focus-visible:outline-(--vscode-focusBorder) peer-disabled:opacity-45">
						{option.label}
					</span>
				</label>
			))}
		</div>
	);
}