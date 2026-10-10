import { Toggle } from '@base-ui/react/toggle';
import { ToggleGroup } from '@base-ui/react/toggle-group';
import { cn } from 'cn';
import type { ReactNode } from 'react';

export type SegmentedOption<Value extends string> = {
	value: Value;
	label: ReactNode;
	disabled?: boolean;
};

export interface SegmentedControlProps<T extends string> {
	ariaLabel?: string;
	label?: string;
	options: readonly SegmentedOption<T>[];
	value: T;
	onValueChange?: (value: T) => void;
	onChange?: (value: T) => void;
	disabled?: boolean;
	className?: string;
	noWrap?: boolean;
}

export type SegmentedProps<T extends string> = SegmentedControlProps<T>;

export function SegmentedControl<T extends string>({
	ariaLabel,
	label,
	options,
	value,
	onValueChange,
	onChange,
	disabled,
	className,
	noWrap,
}: SegmentedControlProps<T>) {
	const handleChange = onValueChange ?? onChange;
	return (
		<ToggleGroup
			aria-label={ariaLabel ?? label}
			value={[value]}
			disabled={disabled}
			onValueChange={values => {
				const option = options.find(item => item.value === values[0]);
				if (option) handleChange?.(option.value);
			}}
			className={cn(
				'inline-flex max-w-full shrink-0 items-center overflow-x-auto rounded-sm border border-(--vscode-panel-border) p-px',
				noWrap && 'w-max',
				className,
			)}
		>
			{options.map(option => (
				<Toggle
					key={option.value}
					value={option.value}
					disabled={option.disabled}
					className="inline-flex h-6 shrink-0 cursor-pointer items-center justify-center gap-1 whitespace-nowrap rounded-sm px-2 text-xs text-(--vscode-foreground) enabled:hover:bg-(--vscode-list-hoverBackground) data-pressed:bg-(--vscode-list-activeSelectionBackground) data-pressed:text-(--vscode-list-activeSelectionForeground) disabled:cursor-not-allowed disabled:opacity-50"
				>
					{option.label}
				</Toggle>
			))}
		</ToggleGroup>
	);
}

export { SegmentedControl as Segmented };
