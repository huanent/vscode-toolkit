# Repository Guidelines

## Frontend Styling

- Prefer Tailwind CSS utilities for layout, spacing, typography, colors, responsive behavior, and interaction states in webviews.
- Use preset Tailwind border-radius utilities such as `rounded-xs`; do not use arbitrary-value radius utilities such as `rounded-[2px]`.
- Reuse existing UI components and the project's `cn` helper when composing class names. Extract repeated UI into components instead of adding page-specific CSS selectors.
- Use VS Code theme variables through Tailwind utilities so interfaces respect light, dark, and high-contrast themes.
- Keep shared Tailwind entry styles, third-party styles, and necessary global rules in CSS. Add custom CSS only when utilities are unsuitable or would make the implementation substantially less clear.
- When updating an existing page, migrate the styles in the touched scope where practical; avoid unrelated stylesheet rewrites.
- Keep Tailwind class names statically discoverable by the build. Verify affected webviews with `npm run build` and `npm run lint`.
