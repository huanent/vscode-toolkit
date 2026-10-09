# Project Guidelines

These instructions apply to the entire repository. Webview-specific rules apply to the React frontend and its host integration.

## Project-Wide Rules

- Do not add tests unless the user explicitly requests them, including during bug fixes, feature work, and refactors.
- Refactors and renames do not need to preserve backward compatibility unless the user explicitly requests it.
- Use `kebab-case` for code filenames, `PascalCase` for React components and TypeScript types, and `camelCase` for functions and variables.
- When a file's responsibility changes, promptly rename it to reflect its current responsibility.
- When a file accumulates too many responsibilities, split it into focused files with clear ownership.
- Use `@/` for imports from `src/`. Prefer imports such as `@/webview/components/button` over relative paths that traverse up multiple directories.

## Validation

- Run `npm run check-types` and `npm run lint` to validate code changes without formatting files.
- Run `npm run compile` when changes require checking the extension and webview builds.
- `npm run check-types` checks the host and webview independently using `tsconfig.host.json` and `tsconfig.webview.json`.
- `npm run validate` and `npm run compile` do not format files. Run `npm run format` only when formatting is intended; it formats the entire repository.

## Runtime Boundaries

- `src/shared/` and feature `protocol.ts` files contain runtime-independent contracts. The generic webview handshake types live in `src/shared/webview-protocol.ts`.
- Webviews must not import host or application implementations, VS Code, or Node built-ins. Feature imports are limited to `protocol.ts` and the browser-safe `database/sqlite-schema.ts`.
- Host code must not import webview implementations. Shared code must not depend on Node, VS Code, React, or host/webview adapters.
- Import restrictions are checked by lint. Keep cross-directory imports explicit using `@/`.
- `src/app/` owns application composition and concrete feature registration. Host infrastructure must not import features or application composition; features must not import the application layer.
- Register extension resources with `ExtensionContext.subscriptions`. Service instance ownership and shutdown belong to application composition, not webview resolution.

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
