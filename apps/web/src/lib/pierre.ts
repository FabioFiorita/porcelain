import type {
  FileDiffOptions,
  FileOptions,
  ThemesType,
} from '@pierre/diffs/react';

/** Keep Pierre's renderer on the same palette as the surrounding shadcn card. */
export const PIERRE_THEME: ThemesType = {
  light: 'pierre-light',
  dark: 'pierre-dark',
};

/**
 * Pierre renders inside a shadow root, so app styles cannot reach its host.
 * These are the small set of surface overrides shared by files and diffs.
 */
export const PIERRE_SURFACE_CSS = `
:host {
  --diffs-light-bg: var(--card) !important;
  --diffs-dark-bg: var(--card) !important;
}

* {
  scrollbar-width: thin;
  scrollbar-color: var(--border) transparent;
}
`;

export function createPierreFileOptions(
  themeType: 'light' | 'dark',
): FileOptions<undefined, undefined> {
  return {
    theme: PIERRE_THEME,
    themeType,
    overflow: 'scroll',
    disableFileHeader: true,
    unsafeCSS: PIERRE_SURFACE_CSS,
  };
}

export function createPierreDiffOptions(
  themeType: 'light' | 'dark',
): FileDiffOptions<undefined, undefined> {
  return {
    theme: PIERRE_THEME,
    themeType,
    overflow: 'scroll',
    diffStyle: 'unified',
    diffIndicators: 'classic',
    hunkSeparators: 'line-info',
    disableFileHeader: true,
    unsafeCSS: PIERRE_SURFACE_CSS,
  };
}
