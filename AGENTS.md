# Project Guidelines

These instructions apply to the entire repository. Webview-specific rules apply to the React frontend and its host integration.

## Project-Wide Rules

- Do not add tests unless the user explicitly requests them, including during bug fixes, feature work, and refactors.
- Refactors and renames do not need to preserve backward compatibility unless the user explicitly requests it.
- Use `kebab-case` for code filenames, `PascalCase` for React components and TypeScript types, and `camelCase` for functions and variables.
- Use `@/` for imports from `src/`. Prefer imports such as `@/webview/components/button` over relative paths that traverse up multiple directories.

## Validation

- Run `npm run check-types` and `npm run lint` to validate code changes without formatting files.
- Run `npm run compile` when changes require checking the extension and webview builds.
- `npm run format` formats the entire repository. Both `npm run validate` and `npm run compile` invoke it; keep unrelated formatting changes out of the patch.

## Webview Architecture

### File Ownership

- `src/webview/bootstrap.tsx`: React webview entry point.
- `src/webview/components/`: shared components and stable shared page structures.
- `src/webview/pages/<page>/`: page entries and page-specific components.
- `src/webview/styles.css`: global base styles and VS Code theme integration only.

Page entry files should compose components and manage page state rather than duplicate shared JSX. Reuse existing shared components; extract new shared components when used by multiple pages or when they represent a stable shared page structure.

### Host Integration

Reuse the shared webview infrastructure; do not re-implement it per feature:

- `src/host/webview-html.ts` builds HTML, rewrites Vite's root-absolute asset URLs, and applies the CSP for both webview views and custom editors. Pages must not declare asset paths.
- `src/host/webview-bridge.ts` owns the host-side `ready` -> `loaded` / `error` protocol.
- `src/host/webview-editor.ts` registers read-only custom editors from a definition containing `viewType`, `page`, `icon`, `validate`, `load`, and `data`.
- `src/webview/utils/host-data.ts` provides `useHostData<TData>()` for payload state and `getRootData()` for host-provided `data-*` values.

### Adding Pages and Editors

- Create each page entry at `src/webview/pages/<page>/app.tsx`.
- Page entries are discovered automatically and use the shared `src/webview/index.html` template; adding a page does not require changing `vite.config.mts`.
- For a custom editor, also declare `contributes.customEditors` in `package.json` and call `registerWebviewEditor` with a `load` function.

## Webview UI and Styling

- Prefer `@base-ui/react` primitives when building shared components in `src/webview/components/` whenever an equivalent control exists.
- Prefer shared components from `src/webview/components/` when implementing UI. If a reusable control is missing, add or extend a shared component before using Base UI primitives directly or hand-rolling controls in pages.
- Keep semantic structures such as tables and the custom tree when Base UI has no equivalent.
- Never use inline `style` attributes in webview JSX; the CSP uses `default-src 'none'`.
- Use VS Code CSS variables for colors so the webview follows the active theme.
- Use built-in integer Tailwind tokens for dimensions, such as `mt-2`, `px-4`, `size-10`, and `text-sm`. Do not use arbitrary values, explicit pixel or relative units, or fractional dimension tokens.
- Before adding styles, check for reusable integer Tailwind tokens and VS Code theme variables.
