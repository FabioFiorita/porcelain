import { createThemeCss, themeTokenClasses } from '@tanstack/highlight/theme';
import { githubDarkTheme } from '@tanstack/highlight/themes/github-dark';
import { githubLightTheme } from '@tanstack/highlight/themes/github-light';

export const codeThemeCss = [
  createThemeCss({
    light: githubLightTheme,
    dark: githubDarkTheme,
    lightSelector: '.review-code',
    darkSelector: '.dark .review-code',
    includeBaseStyles: false,
  }),
  ...themeTokenClasses.map(
    (token) => `.review-code .th-${token} { color: var(--th-${token}); }`,
  ),
].join('\n');
