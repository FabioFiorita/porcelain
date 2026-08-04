# `@porcelain/ui`

This package owns the platform-neutral Tailwind vocabulary used by the web and mobile clients:
semantic colors, radii, typography scale, and font slots. Both clients import
`@porcelain/ui/tokens.css` from their own CSS entrypoint.

The entrypoints remain separate because the web needs DOM preflight, browser selectors, fonts,
scrollbars, and Electron chrome rules, while mobile needs NativeWind's React Native CSS imports.
Keep those platform-specific rules in `apps/web/src/assets/main.css` and
`apps/mobile/src/global.css`; do not copy the token blocks back into either app.
