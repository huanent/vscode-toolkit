import { useEffect, useMemo, useRef } from 'react';
import { renderMarkdown } from '../lib/markdown';

async function writeClipboard(text: string): Promise<void> {
	try {
		await navigator.clipboard.writeText(text);
		return;
	} catch {
		const textarea = document.createElement('textarea');
		textarea.value = text;
		textarea.style.position = 'fixed';
		textarea.style.opacity = '0';
		document.body.append(textarea);
		textarea.select();
		const copied = document.execCommand('copy');
		textarea.remove();
		if (!copied) throw new Error('Clipboard access was denied.');
	}
}

export function useMarkdownContent(text: string) {
	const html = useMemo(() => renderMarkdown(text), [text]);
	const containerRef = useRef<HTMLDivElement>(null);

	useEffect(() => {
		const container = containerRef.current;
		const elements = Array.from(
			container?.querySelectorAll<HTMLElement>('pre, .katex-display') ?? [],
		);
		const updateOverflow = (element: HTMLElement) => {
			const maxScrollLeft = element.scrollWidth - element.clientWidth;
			element.dataset.overflowLeft = String(element.scrollLeft > 1);
			element.dataset.overflowRight = String(maxScrollLeft - element.scrollLeft > 1);
		};
		const resizeObserver = new ResizeObserver(entries =>
			entries.forEach(entry => updateOverflow(entry.target as HTMLElement)),
		);
		const feedbackTimers = new Set<ReturnType<typeof setTimeout>>();
		const copyCode = async (button: HTMLButtonElement) => {
			const pre = button.parentElement?.querySelector('pre');
			const icon = button.querySelector<HTMLElement>('.codicon');
			if (!pre || !icon) return;
			try {
				await writeClipboard(pre.querySelector('code')?.textContent ?? pre.textContent ?? '');
				icon.className = 'codicon codicon-check';
				button.title = 'Copied';
				button.setAttribute('aria-label', 'Copied');
				const timer = setTimeout(() => {
					feedbackTimers.delete(timer);
					icon.className = 'codicon codicon-copy';
					button.title = 'Copy code';
					button.setAttribute('aria-label', 'Copy code');
				}, 1500);
				feedbackTimers.add(timer);
			} catch {
				button.title = 'Copy failed';
				button.setAttribute('aria-label', 'Copy failed');
			}
		};
		const handleClick = (event: MouseEvent) => {
			const target = event.target;
			if (!(target instanceof Element)) return;
			const button = target.closest<HTMLButtonElement>('.markdown-code-copy');
			if (button && container?.contains(button)) void copyCode(button);
		};
		container?.addEventListener('click', handleClick);
		const cleanups = elements.map(element => {
			const update = () => updateOverflow(element);
			update();
			element.addEventListener('scroll', update, { passive: true });
			resizeObserver.observe(element);
			return () => element.removeEventListener('scroll', update);
		});

		return () => {
			feedbackTimers.forEach(clearTimeout);
			container?.removeEventListener('click', handleClick);
			cleanups.forEach(cleanup => cleanup());
			resizeObserver.disconnect();
		};
	}, [html]);

	return { html, containerRef };
}
