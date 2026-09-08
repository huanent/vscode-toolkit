import assert from 'node:assert/strict';
import test from 'node:test';
import { cn } from 'cn';

test('caller classes override control dimensions and borders', () => {
	assert.equal(cn('grid size-8.5 border', 'size-7 border-0'), 'grid size-7 border-0');
	assert.equal(cn('w-full h-8.5 px-2.5', 'h-7 w-18'), 'px-2.5 h-7 w-18');
});

test('password padding survives nested input composition', () => {
	assert.equal(cn('h-8.5 px-2.5', cn('pr-9', undefined)), 'h-8.5 px-2.5 pr-9');
});

test('VS Code theme colors merge without removing font size or family', () => {
	assert.equal(
		cn(
			'text-xs font-(family-name:--vscode-editor-font-family) text-(--vscode-input-foreground)',
			'text-(--vscode-dropdown-foreground)',
		),
		'text-xs font-(family-name:--vscode-editor-font-family) text-(--vscode-dropdown-foreground)',
	);
});

test('responsive and important state styles retain separate scopes', context => {
	assert.equal(
		cn('grid-cols-1 max-[640px]:grid-cols-1', 'grid-cols-2'),
		'max-[640px]:grid-cols-1 grid-cols-2',
	);
	assert.equal(
		cn(
			'bg-transparent hover:bg-(--vscode-list-hoverBackground)',
			Boolean(context.name) && 'bg-(--vscode-list-activeSelectionBackground)!',
		),
		'bg-transparent hover:bg-(--vscode-list-hoverBackground) bg-(--vscode-list-activeSelectionBackground)!',
	);
});

test('custom icon classes and conditional inputs are preserved', () => {
	assert.equal(
		cn('codicon', 'codicon-eye', false, undefined, { 'codicon-modifier-spin': true }),
		'codicon codicon-eye codicon-modifier-spin',
	);
});
