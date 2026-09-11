import { Sparkles, CircleCheck } from '../../../components/icons';
import { useModelPicker } from '../hooks/useModelPicker';
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
	const { open, setOpen, rootRef } = useModelPicker(disabled);
	const selectedModel = models.find(model => model.id === selectedModelId);
	const label = error
		? 'No models available'
		: (selectedModel?.name ?? (models.length ? 'Select model' : 'Loading models...'));
	const providers = new Map<string, ModelItem[]>();
	for (const model of models)
		providers.set(model.providerName, [...(providers.get(model.providerName) ?? []), model]);

	return (
		<div
			className="relative min-w-0 max-w-[min(60vw,320px)] max-[620px]:max-w-[52vw]"
			ref={rootRef}
		>
			<Button variant="text" size="sm"
				left={<Sparkles size="sm" />}
				active={open}
				disabled={disabled || models.length === 0}
				aria-haspopup="listbox"
				aria-expanded={open}
				title={selectedModel ? `${selectedModel.providerName} · ${selectedModel.name}` : label}
				onClick={() => setOpen(value => !value)}
			>
				<span className="block truncate">{label}</span>
			</Button>
			{open && (
				<div
					className="absolute bottom-[calc(100%+5px)] left-0 z-30 max-h-[min(320px,calc(100vh-150px))] w-[min(288px,calc(100vw-24px))] overflow-y-auto rounded border border-(--vscode-widget-border,var(--vscode-panel-border)) bg-(--vscode-menu-background,var(--vscode-editorWidget-background)) p-1 text-(--vscode-menu-foreground,var(--vscode-foreground)) shadow-[0_6px_20px_var(--vscode-widget-shadow)]"
					role="listbox"
					aria-label="Language models"
				>
					{[...providers].map(([providerName, providerModels]) => (
						<div key={providerName}>
							<div className="px-2 pt-2 pb-1 text-xs font-medium wrap-anywhere text-(--vscode-descriptionForeground)">
								{providerName}
							</div>
							{providerModels.map(model => (
								<Button variant="text"
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
										<span className="wrap-anywhere">
											{model.name}
										</span>
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
				</div>
			)}
		</div>
	);
}
