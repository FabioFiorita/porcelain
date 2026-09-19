/**
 * Code sits on the same card as the rest of the document instead of the theme's
 * own black or white page. The theme writes its background into the shadow
 * root, so the override has to land there too, through `unsafeCSS`.
 */
export const SURFACE_CSS = `
:host {
  --diffs-light-bg: var(--card) !important;
  --diffs-dark-bg: var(--card) !important;
}
/* Long lines scroll inside the shadow root; match the shadcn thumb there too. */
* {
  scrollbar-width: thin;
  scrollbar-color: var(--border) transparent;
}
`;

/**
 * Pierre's built-in gutter button, restyled through `unsafeCSS` (which lands
 * inside the shadow root). Only the built-in button supports press-and-drag to
 * select a block. With `lineHoverHighlight: 'number'` the hovered row's number
 * cell is marked, so that one number hides and the ＋ takes its place.
 */
export const GUTTER_CSS = `${SURFACE_CSS}
/*
 * Annotations live in the code column, beside an empty strip of line-number
 * gutter. Pull them over the gutter (it is sticky at z-index 3) so comments and
 * the composer span the whole width of the file.
 */
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
  background-color: var(--comment-accent);
  color: var(--primary-foreground);
  box-shadow: 0 1px 2px rgb(0 0 0 / 0.2);
  transition: transform 120ms ease, background-color 120ms ease;
}
[data-utility-button]:hover {
  transform: scale(1.1);
  background-color: var(--comment-accent-edge);
}
[data-utility-button]::before {
  inset: -2px -8px;
}
`;

/**
 * The hovered line's number makes way for the ＋. Only where comments are on:
 * in a read-only commit there is no ＋, and hiding the number just blanks it.
 */
export const PLUS_OVER_NUMBER_CSS = `
[data-column-number][data-hovered] [data-line-number-content] {
  visibility: hidden;
}
`;

/** A single file under the document toolbar starts at the first line, with no gap above it. */
export const FLUSH_TOP_CSS = `
[data-code] {
  padding-top: 0 !important;
}
`;

export const PIERRE_THEME = {
  light: 'pierre-light',
  dark: 'pierre-dark',
} as const;

export const itemId = (kind: 'diff' | 'file', path: string) =>
  `${kind}:${path}`;
export const pathOfItem = (id: string) => id.replace(/^(diff|file):/, '');
