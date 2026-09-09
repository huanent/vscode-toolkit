import { cn } from 'cn';
interface Option<Value extends string> {
	value: Value;
	label: string;
}

export function SegmentedControl<Value extends string>({
	label,
	options,
	value,
	onChange,
}: {
	label: string;
	options: Option<Value>[];
	value: Value;
	onChange: (value: Value) => void;
}) {
	return (
		<div
			className="inline-grid min-h-8 min-w-0 max-w-full auto-cols-fr grid-flow-col overflow-hidden rounded-xs border border-(--vscode-widget-border,var(--vscode-panel-border)) bg-(--vscode-input-background)"
			role="group"
			aria-label={label}
		>
			{options.map(option => (
				<button
					key={option.value}
					type="button"
					className={cn(
						'min-w-0 border-0 border-r border-(--vscode-widget-border,var(--vscode-panel-border)) bg-transparent px-3 py-1 text-sm font-medium wrap-anywhere text-(--vscode-foreground) last:border-r-0 hover:bg-(--vscode-toolbar-hoverBackground)',
						value === option.value
							? 'bg-(--vscode-button-background)! text-(--vscode-button-foreground)!'
							: '',
					)}
					aria-pressed={value === option.value}
					onClick={() => onChange(option.value)}
				>
					{option.label}
				</button>
			))}
		</div>
	);
}
