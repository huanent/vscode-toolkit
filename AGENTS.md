## Frontend Guidelines

### Webview Structure

- `src/webview/bootstrap.tsx` is the React webview entry point.
- `src/webview/components/` contains components shared across pages.
- `src/webview/pages/` contains page entries and page-specific components.
- `src/webview/styles.css` should contain only global base styles and VS Code theme integration.

### Webview Host Integration

Do not re-implement webview plumbing per feature. The shared layer under `src/host/` and `src/webview/utils/` owns it:

- `src/host/webview-html.ts` builds a page's HTML, rewriting Vite's root-absolute asset URLs and applying the CSP. It is used by both `WebviewViewProvider` and custom editors, so pages declare no asset paths.
- `src/host/webview-bridge.ts` implements the host side of the `ready` → `loaded` / `error` protocol.
- `src/host/webview-editor.ts` registers a read-only custom editor from a small definition (`viewType`, `page`, `icon`, `validate`, `load`, `data`).
- `src/webview/utils/host-data.ts` implements the webview side: `useHostData<TData>()` for the payload state and `getRootData()` for host-provided `data-*` values.

Adding a custom editor therefore means: create the page under `src/webview/pages/<page>/`, declare `contributes.customEditors` in `package.json`, and call `registerWebviewEditor` with a `load` function. Adding a webview page needs no `vite.config.mts` change because entries are discovered from `src/webview/pages/*/index.html`.

Never use inline `style` attributes in webview JSX; pages are served under a strict CSP with `default-src 'none'`.

### Component Reuse

Reuse existing components from `src/webview/components/` whenever possible. Extract a component there when it is used by multiple pages or represents a stable shared page structure. Keep page-specific presentation details under the relevant `pages/<page>/components/` directory.

Page entry files should compose components and manage page state rather than duplicate shared JSX.

### Testing

UI components do not need tests unless they contain non-trivial business logic or behavior that is not covered elsewhere.

### Base UI

- Use `@base-ui/react` primitives for interactive webview controls whenever an equivalent primitive exists. Prefer shared wrappers in `src/webview/components/` for consistent styling, and avoid hand-rolling controls that Base UI provides.
- Keep semantic structures such as tables and the custom tree when Base UI has no equivalent.

### Import Aliases

Use `@/` as the alias for the `src/` directory. Prefer imports such as `@/webview/components/button` over relative paths that traverse up multiple directories.

### Naming

Use `kebab-case` for code filenames, Use `PascalCase` for React components and TypeScript types. Use `camelCase` for functions and variables.

### Tailwind CSS

Prefer built-in integer Tailwind tokens for dimensions, such as `mt-2`, `px-4`, `size-10`, and `text-sm`. Do not use arbitrary values, explicit pixel or relative units, or fractional dimension tokens. Use VS Code CSS variables for colors so the webview follows the active VS Code theme.

Before adding styles, check whether an existing integer Tailwind token or VS Code theme variable can be reused.

### Compatibility

- Refactors and renames do not need to preserve backward compatibility unless the user explicitly requests it.
