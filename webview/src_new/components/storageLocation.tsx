import { Field } from './ui/field';
import { Select } from './ui/input';
import { Segmented } from './ui/segmented';

export function StorageLocation({
	value,
	folders,
	disabled,
	onChange,
	inline = false,
}: {
	value: string;
	folders: { name: string; uri: string }[];
	disabled: boolean;
	onChange(value: string): void;
	inline?: boolean;
}) {
	return (
		<div className={inline
			? 'grid w-full grid-flow-col grid-cols-[100%] auto-cols-max items-end gap-3'
			: 'mx-auto mb-3 grid w-[min(880px,calc(100%-44px))] gap-2 max-[680px]:w-[calc(100%-28px)]'}>
			<Segmented
				noWrap={inline}
				className={inline ? 'w-full' : undefined}
				label="Storage location"
				value={value ? 'workspace' : 'global'}
				options={[
					{ value: 'global', label: 'Global' },
					{ value: 'workspace', label: 'Workspace', disabled: folders.length === 0 },
				]}
				disabled={disabled}
				onChange={location => onChange(location === 'global' ? '' : folders[0].uri)}
			/>
			{value && (
				<Field label="Workspace folder">
					{control => (
						<Select
							{...control}
							value={value}
							disabled={disabled}
							onChange={event => onChange(event.target.value)}
						>
							{folders.map(folder => (
								<option key={folder.uri} value={folder.uri}>
									{folder.name}
								</option>
							))}
						</Select>
					)}
				</Field>
			)}
		</div>
	);
}