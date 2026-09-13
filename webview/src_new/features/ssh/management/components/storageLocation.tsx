import { Field } from '../../../../components/field';
import { Select } from '../../../../components/input';
import { Segmented } from '../../../../components/segmented';

export function StorageLocation({
	value,
	folders,
	disabled,
	onChange,
}: {
	value: string;
	folders: { name: string; uri: string }[];
	disabled: boolean;
	onChange(value: string): void;
}) {
	return (
		<div className="mx-auto mb-3 grid w-[min(880px,calc(100%-44px))] gap-2 max-[680px]:w-[calc(100%-28px)]">
			<Segmented
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
