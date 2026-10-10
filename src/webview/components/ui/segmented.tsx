import { SegmentedControl as SourceSegmentedControl } from '@/webview/components/segmented-control';
import type { ReactNode } from 'react';

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
	noWrap?: boolean;
};

export function Segmented<Value extends string>({ label, value, options, onChange, disabled = false, className, noWrap = false }: SegmentedProps<Value>) {
	return (
		<SourceSegmentedControl
			ariaLabel={label}
			value={value}
			options={options}
			onValueChange={onChange}
			disabled={disabled}
			className={className}
			noWrap={noWrap}
		/>
	);
}