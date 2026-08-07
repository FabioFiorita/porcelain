/**
 * The one set of spacing tokens every mobile surface aligns to.
 *
 * Before this existed each surface picked its own number: the header sat at 16pt, the toolbar
 * under it at 12pt, and the list rows at 8pt — three left edges down a 390pt screen, which is
 * what makes a phone build read as unfinished no matter how good the content is. The gutter is
 * a token so a new surface inherits the alignment instead of guessing at it, and so the guess
 * is a one-line diff to review rather than a class buried in a `contentContainerClassName`.
 *
 * `surface-gutter.test.ts` fails the build when a surface hardcodes a different one.
 */

/**
 * The horizontal gutter: the large title, every toolbar, every note, and the outer edge of a
 * list row all start here. A row's own padding sits *inside* it, so row text is indented from
 * the section label above it — the card is inset, the chrome is not.
 */
export const SURFACE_GUTTER = 'px-4'

/**
 * The band directly under the header's divider — a toolbar, a segmented control, a summary.
 *
 * `pt-3` mirrors the `pb-3` the header spends above the divider. The two were 10pt and 4pt,
 * which is the kind of near-miss that looks like a rendering bug rather than a choice.
 */
export const SURFACE_TOOLBAR = 'px-4 pb-2 pt-3'

/** A note hanging under the toolbar: an error, an action failure, a loading line. */
export const SURFACE_NOTE = 'px-4 pb-2'

/** Padding above the header's divider. Kept equal to `SURFACE_TOOLBAR`'s top padding. */
export const SURFACE_HEADER_BAND = 'px-4 pb-3'
