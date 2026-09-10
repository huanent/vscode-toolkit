import { Field } from './field';
import { SelectInput } from './input';

export function StorageLocation({ value, folders, disabled, onChange }: {
	value: string;
	folders: { name: string; uri: string }[];
	disabled: boolean;
	onChange: (value: string) => void;
}) {
	return (
		<div className="mx-auto mb-3 grid w-[min(880px,calc(100%-44px))] gap-2 max-[680px]:w-[calc(100%-28px)]">
			<Field label="Storage">
				<div className="inline-flex overflow-hidden rounded-xs border border-(--vscode-input-border)" role="group" aria-label="Storage location">
					{['Global', 'Workspace'].map((label, index) => (
						<button key={label} type="button" aria-pressed={index === 0 ? !value : !!value}
							disabled={disabled || (index === 1 && !folders.length)}
							className="px-3 py-1 text-sm aria-pressed:bg-(--vscode-button-background) aria-pressed:text-(--vscode-button-foreground) disabled:opacity-50"
							onClick={() => onChange(index === 0 ? '' : folders[0].uri)}>{label}</button>
					))}
				</div>
			</Field>
			{value && <Field label="Workspace folder"><SelectInput value={value} disabled={disabled} onChange={event => onChange(event.target.value)}>
				{folders.map(folder => <option key={folder.uri} value={folder.uri}>{folder.name}</option>)}
			</SelectInput></Field>}
		</div>
	);
}