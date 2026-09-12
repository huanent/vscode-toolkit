import { Sparkles, CircleCheck } from '../../../components/icons';
import { useState } from 'react';
import { Popover } from '../../../components/popover';
import type { ModelItem } from '../types';
import { Button } from '../../../components/button';
import { List, ListGroup, ListItem } from '../../../components/list';

type ModelPickerProps = {
	models: ModelItem[];
	selectedModelId: string;
	disabled: boolean;
	error: boolean;
	onSelect(modelId: string): void;
};

export function ModelPicker({
	models,
	selectedModelId,
	disabled,
	error,
	onSelect,
}: ModelPickerProps) {
	const [open, setOpen] = useState(false);
	const selectedModel = models.find(model => model.id === selectedModelId);
	const label = error
		? 'No models available'
		: (selectedModel?.name ?? (models.length ? 'Select model' : 'Loading models...'));
	const providers = new Map<string, ModelItem[]>();
	for (const model of models)
		providers.set(model.providerName, [...(providers.get(model.providerName) ?? []), model]);

	return (
		<div className="relative min-w-0 max-w-[min(60vw,320px)] max-[620px]:max-w-[52vw]">
			<Popover
				open={open}
				onOpenChange={setOpen}
				disabled={disabled || models.length === 0}
				placement="top-start"
				role="listbox"
				label="Language models"
				className="max-h-[min(320px,calc(100dvh-16px))] w-72 p-1"
				trigger={props => (
					<Button
						{...props}
						variant="text"
						size="sm"
						left={<Sparkles size="sm" />}
						active={open}
						title={selectedModel ? `${selectedModel.providerName} · ${selectedModel.name}` : label}
					>
						<span className="block truncate">{label}</span>
					</Button>
				)}
			>
				<List role="presentation">
					{[...providers].map(([providerName, providerModels]) => (
						<ListGroup key={providerName} label={providerName} options>
							{providerModels.map(model => (
								<ListItem
									icon={
										<CircleCheck
											size="sm"
											className={model.id === selectedModelId ? 'visible' : 'invisible'}
										/>
									}
									key={model.id}
									role="option"
									selected={model.id === selectedModelId}
									description={model.family !== model.name ? model.family : undefined}
									onSelect={() => {
										onSelect(model.id);
										setOpen(false);
									}}
								>
									{model.name}
								</ListItem>
							))}
						</ListGroup>
					))}
				</List>
			</Popover>
		</div>
	);
}
