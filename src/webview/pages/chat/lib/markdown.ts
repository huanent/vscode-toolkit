import DOMPurify from 'dompurify';
import katex from 'katex';
import MarkdownIt from 'markdown-it';
import texmath from 'markdown-it-texmath';
import Prism from 'prismjs';
import 'prismjs/components/prism-bash';
import 'prismjs/components/prism-c';
import 'prismjs/components/prism-cpp';
import 'prismjs/components/prism-csharp';
import 'prismjs/components/prism-go';
import 'prismjs/components/prism-java';
import 'prismjs/components/prism-jsx';
import 'prismjs/components/prism-markdown';
import 'prismjs/components/prism-python';
import 'prismjs/components/prism-rust';
import 'prismjs/components/prism-sql';
import 'prismjs/components/prism-typescript';
import 'prismjs/components/prism-tsx';
import 'prismjs/components/prism-yaml';

const markdown = new MarkdownIt({
	breaks: true,
	html: false,
	linkify: true,
	highlight(code: string, language: string) {
		const grammar = language ? Prism.languages[language] : undefined;
		return grammar ? Prism.highlight(code, grammar, language) : '';
	},
}).use(texmath, {
	engine: katex,
	delimiters: 'dollars',
	katexOptions: { strict: 'ignore', throwOnError: false },
});

markdown.renderer.rules.table_open = () => '<div class="markdown-overflow"><table>';
markdown.renderer.rules.table_close = () => '</table></div>';

const defaultFenceRenderer = markdown.renderer.rules.fence!;
markdown.renderer.rules.fence = (tokens, index, options, environment, renderer) => {
	const codeBlock = defaultFenceRenderer(tokens, index, options, environment, renderer);
	return `<div class="markdown-code-block">${codeBlock}<button class="markdown-code-copy" type="button" title="Copy code" aria-label="Copy code"><span class="codicon codicon-copy" aria-hidden="true"></span></button></div>`;
};

export function renderMarkdown(text: string): string {
	return DOMPurify.sanitize(markdown.render(text));
}
