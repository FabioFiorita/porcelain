import type { FileOptions, ThemesType } from '@pierre/diffs/react';
import { registerCustomCSSVariableTheme } from '@pierre/diffs';
import {
  CONTENT_VERSION_HASH_OFFSET,
  CONTENT_VERSION_HASH_PRIME,
} from '@/config/limits';

function preferredHighlighter(): 'highlights' | 'shiki-js' {
  try {
    new WebAssembly.Module(Uint8Array.of(0, 97, 115, 109, 1, 0, 0, 0));
    return 'highlights';
  } catch {
    return 'shiki-js';
  }
}

export const PIERRE_HIGHLIGHTER = preferredHighlighter();

export const PIERRE_THEME: ThemesType = {
  light: 'pierre-light',
  dark: 'pierre-dark',
};

export const PIERRE_DECISION_THEME = 'porcelain-review';

registerCustomCSSVariableTheme(PIERRE_DECISION_THEME, {});

const PIERRE_CARD_CSS = `
[data-diffs-header] {
  min-height: calc(var(--spacing) * 10);
  padding-inline: calc(var(--spacing) * 2) calc(var(--spacing) * 1.5);
  border: 1px solid var(--border);
  border-radius: var(--radius-lg) var(--radius-lg) 0 0;
  background: var(--muted);
}
[data-diffs-header] [data-change-icon] {
  display: none;
}
[data-diffs-header] [data-title] {
  font-family: var(--font-mono);
  font-size: var(--text-caption);
  font-weight: 500;
  line-height: calc(var(--spacing) * 4);
  color: var(--foreground);
}
[data-diffs-header] [data-deletions-count],
[data-diffs-header] [data-additions-count] {
  font-family: var(--font-mono);
  font-size: var(--text-xs);
  font-weight: 500;
  line-height: calc(var(--spacing) * 4);
}
[data-diffs-header] [data-deletions-count] {
  color: var(--del-fg);
}
[data-diffs-header] [data-additions-count] {
  color: var(--add-fg);
}
pre {
  border: 1px solid var(--border);
  border-top: 0;
  border-radius: 0 0 var(--radius-lg) var(--radius-lg);
}
`;

export const PIERRE_CHANGES_HEADER_CSS = `
:host {
  --diffs-font-size: var(--text-caption);
  --diffs-line-height: calc(var(--spacing) * 5.5);
  --diffs-fg-number-addition-override: var(--muted-foreground);
  --diffs-fg-number-deletion-override: var(--muted-foreground);
  --diffs-min-number-column-width: calc(var(--spacing) * 4.5);
  --diffs-gap-style: calc(var(--spacing) * .5) solid transparent;
}
[data-diffs-header] [data-deletions-count],
[data-diffs-header] [data-additions-count] {
  display: none;
}
[data-code] {
  padding-block: 0;
  scrollbar-gutter: auto;
}
pre {
  overflow: hidden;
}

[data-diffs-header] {
  min-height: calc(var(--spacing) * 10.25);
  padding-inline: calc(var(--spacing) * 2);
}
[data-diffs-header] [data-change-icon] {
  display: none;
}
[data-diffs-header] [data-title] {
  font-family: var(--font-mono);
  font-size: var(--text-caption);
  font-weight: 500;
  line-height: calc(var(--spacing) * 4);
  color: var(--foreground);
}
[data-diffs-header] [data-deletions-count],
[data-diffs-header] [data-additions-count] {
  font-family: var(--font-mono);
  font-size: var(--text-xs);
  font-weight: 500;
  line-height: calc(var(--spacing) * 4);
}
[data-diffs-header] [data-deletions-count] {
  color: var(--del-fg);
}
[data-diffs-header] [data-additions-count] {
  color: var(--add-fg);
}
`;

export const PIERRE_DECISION_CSS = `
[data-line-type='change-addition'] {
  --diffs-computed-diff-line-bg: var(--add-bg);
}
[data-line-type='change-deletion'] {
  --diffs-computed-diff-line-bg: var(--del-bg);
}
${PIERRE_CARD_CSS}`;

export const PIERRE_HEADER_CSS = `
@media (max-width: 720px) {
  [data-header-content] {
    flex: 1 1 auto;
    min-width: 6rem;
    overflow: hidden;
  }
  [data-metadata] {
    flex: 0 1 auto;
    min-width: 0;
    overflow: hidden;
  }
}
`;

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

type PierreDisplayOptions = {
  overflow?: 'scroll' | 'wrap';
  diffStyle?: 'unified' | 'split';
};

export function createPierreFileOptions(
  themeType: 'light' | 'dark',
  display: Pick<PierreDisplayOptions, 'overflow'> = {},
): FileOptions<undefined, undefined> {
  return {
    preferredHighlighter: PIERRE_HIGHLIGHTER,
    theme: PIERRE_THEME,
    themeType,
    overflow: display.overflow ?? 'scroll',
    disableFileHeader: true,
    unsafeCSS: PIERRE_SURFACE_CSS,
  };
}

export function contentVersion(value: string) {
  let hash = CONTENT_VERSION_HASH_OFFSET;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, CONTENT_VERSION_HASH_PRIME);
  }
  return hash >>> 1;
}

export const PIERRE_FILE_CSS = `
[data-gutter] {
  min-width: calc(var(--spacing) * 12);
}
[data-column-number] {
  min-width: calc(var(--spacing) * 12);
  padding-inline: 0 calc(var(--spacing) * 3);
}
[data-code] [data-line] {
  padding-inline-start: calc(var(--spacing) * 3);
}
[data-code] {
  padding-top: var(--spacing) !important;
}
`;
