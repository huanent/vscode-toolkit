import { Sparkles, CircleCheck } from '../../../components/icons';
import { useState } from 'react';
import { Popover } from '../../../components/popover';
import type { ModelItem } from '../types';
import { Button } from '../../../components/button';

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
				{[...providers].map(([providerName, providerModels]) => (
					<div key={providerName}>
						<div className="px-2 pt-2 pb-1 text-xs font-medium wrap-anywhere text-(--vscode-descriptionForeground)">
							{providerName}
						</div>
						{providerModels.map(model => (
							<Button
								variant="text"
								className="w-full justify-start text-left text-(--vscode-menu-foreground,var(--vscode-foreground)) aria-selected:[&_.model-check]:visible"
								left={<CircleCheck size="sm" className="model-check invisible" />}
								key={model.id}
								role="option"
								aria-selected={model.id === selectedModelId}
								onClick={() => {
									onSelect(model.id);
									setOpen(false);
								}}
							>
								<span className="grid min-w-0 gap-1">
									<span className="wrap-anywhere">{model.name}</span>
									{model.family !== model.name && (
										<small className="text-xs wrap-anywhere text-(--vscode-descriptionForeground)">
											{model.family}
										</small>
									)}
								</span>
							</Button>
						))}
					</div>
				))}
			</Popover>
		</div>
	);
}
