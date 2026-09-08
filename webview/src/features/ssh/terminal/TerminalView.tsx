import { FitAddon } from '@xterm/addon-fit';
import { Terminal, type ITheme } from '@xterm/xterm';
import '@xterm/xterm/css/xterm.css';
import { useEffect, useImperativeHandle, useRef } from 'react';

export interface TerminalViewHandle {
	writeBase64(data: string): void;
	paste(data: string): void;
	fit(): void;
	focus(): void;
}

function readTerminalTheme(): ITheme {
	const style = getComputedStyle(document.documentElement);
	const value = (name: string, fallback = '') => style.getPropertyValue(name).trim() || fallback;
	const editorForeground = value('--vscode-editor-foreground', value('--vscode-foreground'));
	const terminalForeground = value('--vscode-terminal-foreground', editorForeground);
	return {
		background: value('--vscode-editor-background'),
		foreground: terminalForeground,
		cursor: value('--vscode-terminalCursor-foreground', terminalForeground),
		cursorAccent: value('--vscode-terminalCursor-background', value('--vscode-editor-background')),
		selectionBackground: value('--vscode-terminal-selectionBackground'),
		selectionForeground: value('--vscode-terminal-selectionForeground'),
		selectionInactiveBackground: value('--vscode-terminal-inactiveSelectionBackground'),
		black: value('--vscode-terminal-ansiBlack'),
		red: value('--vscode-terminal-ansiRed'),
		green: value('--vscode-terminal-ansiGreen'),
		yellow: value('--vscode-terminal-ansiYellow'),
		blue: value('--vscode-terminal-ansiBlue'),
		magenta: value('--vscode-terminal-ansiMagenta'),
		cyan: value('--vscode-terminal-ansiCyan'),
		white: value('--vscode-terminal-ansiWhite'),
		brightBlack: value('--vscode-terminal-ansiBrightBlack'),
		brightRed: value('--vscode-terminal-ansiBrightRed'),
		brightGreen: value('--vscode-terminal-ansiBrightGreen'),
		brightYellow: value('--vscode-terminal-ansiBrightYellow'),
		brightBlue: value('--vscode-terminal-ansiBrightBlue'),
		brightMagenta: value('--vscode-terminal-ansiBrightMagenta'),
		brightCyan: value('--vscode-terminal-ansiBrightCyan'),
		brightWhite: value('--vscode-terminal-ansiBrightWhite'),
	};
}

export function TerminalView({
	ref,
	onData,
	onResize,
	onReady,
	onCopy,
	onPaste,
}: {
	ref: React.Ref<TerminalViewHandle>;
	onData: (data: string) => void;
	onResize: (rows: number, columns: number) => void;
	onReady: () => void;
	onCopy: (data: string) => void;
	onPaste: () => void;
}) {
	const elementRef = useRef<HTMLDivElement>(null);
	const terminalRef = useRef<Terminal | null>(null);
	const layoutRef = useRef<(focus?: boolean) => void>(() => {});
	useImperativeHandle(
		ref,
		() => ({
			writeBase64(data) {
				terminalRef.current?.write(
					Uint8Array.from(atob(data), character => character.charCodeAt(0)),
				);
			},
			paste(data) {
				terminalRef.current?.paste(data);
			},
			fit() {
				layoutRef.current();
			},
			focus() {
				layoutRef.current(true);
			},
		}),
		[],
	);
	useEffect(() => {
		const style = getComputedStyle(document.documentElement);
		const themeValue = (name: string, fallback = '') =>
			style.getPropertyValue(name).trim() || fallback;
		const terminal = new Terminal({
			cursorBlink: true,
			cursorStyle: 'bar',
			fontFamily: themeValue('--vscode-editor-font-family'),
			fontSize: Number(themeValue('--vscode-editor-font-size').replace('px', '')) || 14,
			scrollback: 5000,
			theme: readTerminalTheme(),
		});
		const isMac = /Mac|iPhone|iPad/.test(navigator.platform);
		terminal.attachCustomKeyEventHandler(event => {
			if (event.type !== 'keydown') return true;
			const key = event.key.toLowerCase();
			if (
				event.ctrlKey &&
				!event.altKey &&
				!event.metaKey &&
				(key === 'arrowleft' || key === 'arrowright')
			) {
				onData(key === 'arrowleft' ? '\x1b[1;5D' : '\x1b[1;5C');
				return false;
			}
			if (
				isMac &&
				event.metaKey &&
				!event.ctrlKey &&
				!event.altKey &&
				(key === 'arrowleft' || key === 'arrowright')
			) {
				onData(key === 'arrowleft' ? '\x01' : '\x05');
				return false;
			}
			return true;
		});
		const fit = new FitAddon();
		terminal.loadAddon(fit);
		terminal.open(elementRef.current!);
		const handleContextMenu = (event: MouseEvent) => {
			event.preventDefault();
			const selection = terminal.getSelection();
			if (selection) {
				onCopy(selection);
				terminal.clearSelection();
			} else {
				onPaste();
			}
			terminal.focus();
		};
		elementRef.current!.addEventListener('contextmenu', handleContextMenu);
		terminalRef.current = terminal;
		let layoutFrame: number | undefined;
		let focusPending = false;
		const scheduleLayout = (focus = false) => {
			focusPending ||= focus;
			if (layoutFrame !== undefined) cancelAnimationFrame(layoutFrame);
			layoutFrame = requestAnimationFrame(() => {
				layoutFrame = undefined;
				const element = elementRef.current;
				if (document.visibilityState !== 'visible' || !element?.getClientRects().length ||
					!element.clientWidth || !element.clientHeight) return;
				fit.fit();
				terminal.refresh(0, terminal.rows - 1);
				if (focusPending) terminal.focus();
				focusPending = false;
			});
		};
		layoutRef.current = scheduleLayout;
		const handleVisibilityChange = () => {
			if (document.visibilityState === 'visible') scheduleLayout();
		};
		document.addEventListener('visibilitychange', handleVisibilityChange);
		const dataDisposable = terminal.onData(onData);
		const resizeDisposable = terminal.onResize(size => onResize(size.rows, size.cols));
		const observer = new ResizeObserver(() => scheduleLayout());
		observer.observe(elementRef.current!);
		const themeObserver = new MutationObserver(() => {
			terminal.options.theme = readTerminalTheme();
		});
		themeObserver.observe(document.body, { attributes: true, attributeFilter: ['class'] });
		scheduleLayout(true);
		onReady();
		return () => {
			if (layoutFrame !== undefined) cancelAnimationFrame(layoutFrame);
			layoutRef.current = () => {};
			terminalRef.current = null;
			document.removeEventListener('visibilitychange', handleVisibilityChange);
			observer.disconnect();
			themeObserver.disconnect();
			elementRef.current?.removeEventListener('contextmenu', handleContextMenu);
			dataDisposable.dispose();
			resizeDisposable.dispose();
			terminal.dispose();
		};
	}, []);
	return <div ref={elementRef} className="h-full w-full px-1" aria-label="SSH terminal" />;
}
