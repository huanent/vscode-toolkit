# Repository Guidelines

## React Component Organization

- Keep React components focused on a single responsibility. Page and container components should compose smaller components rather than contain all rendering, state, and business logic.
- Keep files and components small: aim for React source files under 300 lines and individual components under 150 lines. Treat these as refactoring guidelines, not hard limits; split by cohesive responsibility rather than mechanically by line count.
- Extract substantial UI sections and repeated rendering into named components. Move complex stateful behavior and effects into focused custom hooks, and move pure business logic into utilities.
- Organize components, hooks, and utilities by feature. Keep feature-specific code close to its consumers; promote code to shared modules only when it is genuinely reusable across features.
- Prefer one primary component per file. Small, tightly coupled helper components may remain in the same file; give substantial components their own files and explicit, typed props.
- When extending an oversized file or component, refactor the touched responsibility before adding more complexity. Avoid unrelated rewrites and trivial abstractions that only scatter code across files.

## Frontend Styling

- Prefer Tailwind CSS utilities for layout, spacing, typography, colors, responsive behavior, and interaction states in webviews.
- Use preset Tailwind border-radius utilities such as `rounded-xs`; do not use arbitrary-value radius utilities such as `rounded-[2px]`.
- Reuse existing UI components and the project's `cn` helper when composing class names. Extract repeated UI into components instead of adding page-specific CSS selectors.
- Use VS Code theme variables through Tailwind utilities so interfaces respect light, dark, and high-contrast themes.
- Keep shared Tailwind entry styles, third-party styles, and necessary global rules in CSS. Add custom CSS only when utilities are unsuitable or would make the implementation substantially less clear.
- When updating an existing page, migrate the styles in the touched scope where practical; avoid unrelated stylesheet rewrites.
- Keep Tailwind class names statically discoverable by the build. Verify affected webviews with `npm run build` and `npm run lint`.
