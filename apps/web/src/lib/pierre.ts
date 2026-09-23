import type { FileOptions, ThemesType } from '@pierre/diffs/react';

export const PIERRE_THEME: ThemesType = {
  light: 'pierre-light',
  dark: 'pierre-dark',
};

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

export type PierreDisplayOptions = {
  overflow?: 'scroll' | 'wrap';
  diffStyle?: 'unified' | 'split';
};

export function createPierreFileOptions(
  themeType: 'light' | 'dark',
  display: Pick<PierreDisplayOptions, 'overflow'> = {},
): FileOptions<undefined, undefined> {
  return {
    theme: PIERRE_THEME,
    themeType,
    overflow: display.overflow ?? 'scroll',
    disableFileHeader: true,
    unsafeCSS: PIERRE_SURFACE_CSS,
  };
}

export const PIERRE_COMMENT_CSS = `
[data-line-annotation] {
  margin-left: calc(-1 * var(--diffs-column-number-width, 0px));
  position: relative;
  z-index: 4;
  background: var(--diffs-bg);
}
[data-gutter-utility-slot] {
  left: 0;
  right: 0;
  justify-content: center;
  align-items: center;
}
[data-utility-button] {
  width: 18px;
  height: 18px;
  margin: 0;
  border-radius: 6px;
  background-color: var(--primary);
  color: var(--primary-foreground);
  box-shadow: 0 1px 2px rgb(0 0 0 / 0.2);
  transition: transform 120ms ease, background-color 120ms ease;
}
[data-utility-button]:hover {
  transform: scale(1.1);
  background-color: var(--primary);
}
[data-utility-button]::before {
  inset: -2px -8px;
}
[data-column-number][data-hovered] [data-line-number-content] { visibility: hidden; }
`;

export function contentVersion(value: string) {
  let hash = 0x811c9dc5;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  return hash >>> 1;
}
