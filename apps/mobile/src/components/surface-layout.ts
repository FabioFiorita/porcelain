import type { ViewStyle } from 'react-native'

/**
 * The one set of spacing tokens every mobile surface aligns to.
 *
 * Before this existed each surface picked its own horizontal padding — 16pt for the header, 12pt
 * for the toolbar under it, 8pt for the list — and the three left edges are what made a phone
 * screen read as unfinished no matter how good the content was. The gutter is a token so a new
 * surface inherits the alignment instead of guessing at it.
 *
 * `surface-layout.test.ts` fails the build when a surface picks a different one.
 */

/**
 * The horizontal gutter: the large title, every toolbar, every note, and the outer edge of a
 * list row all start here. A row's own padding sits *inside* it, so row text is indented from
 * the section label above it — the card is inset, the chrome is not.
 */
export const SURFACE_GUTTER = 'px-4'

/**
 * A selectable list row — Files, Changes, History — inside an **edge-to-edge** list.
 *
 * The row used to sit inside the container's own `SURFACE_GUTTER` and add `px-3` of its own, so
 * row text started 28pt from the bezel while every header above it started at 16pt: the "weird
 * side padding" on Files. The gutter is now split between the two — `mx-2` of margin plus `px-2`
 * of padding — so content lands on the same 16pt line as the chrome, and the pressed/selected
 * card reaches 8pt past it into the gutter, the way a native list highlight does.
 *
 * The row's own vertical rhythm and layout (`min-h-*`, `flex-row`, gaps) stay at the call site;
 * only the horizontal geometry and the card are shared. `surface-layout.test.ts` fails the build
 * when a row goes back to writing its own.
 */
export const SURFACE_ROW = 'mx-2 rounded-xl border border-transparent px-2 py-2 active:bg-accent'

/** The same row, selected: the invisible card becomes visible. */
export const SURFACE_ROW_SELECTED = 'border-border bg-muted/70'

/**
 * The band directly under the header's divider — a toolbar, a segmented control, a summary.
 *
 * Its top padding mirrors the bottom padding the header spends above the divider. The two were
 * 10pt and 4pt, which is the kind of near-miss that looks like a rendering bug rather than a
 * choice.
 */
export const SURFACE_TOOLBAR = 'px-4 pb-2 pt-3'

/**
 * The gap between peer controls stacked inside a toolbar band — a segmented control over a
 * search field, a summary row over a scope switcher.
 *
 * Equal to the band's own top padding, so the run from the divider down reads as one even
 * rhythm. It was `gap-2` against a `pt-3` band: 8pt under the tabs, 12pt above them, close
 * enough to look like a mistake and far enough to see.
 *
 * NOT for a label and its detail line — those are one block and stay tight (`gap-1`).
 */
export const SURFACE_STACK_GAP = 'gap-3'

/** A note hanging under the toolbar: an error, an action failure, a loading line. */
export const SURFACE_NOTE = 'px-4 pb-2'

/** Padding above the header's divider. Kept equal to `SURFACE_TOOLBAR`'s top padding. */
export const SURFACE_HEADER_BAND = 'px-4 pb-3'

/**
 * `SURFACE_GUTTER` as a number, for the scroll containers that cannot use the class.
 *
 * Equal to `px-4` only because `src/global.css` pins `--spacing` to `4px`. Left on Tailwind's
 * default `0.25rem` the class measured 14pt against this 16, and chrome written in classes sat
 * 2pt inside lists written in points — see the note on `--spacing`, and keep the two in step.
 */
export const SURFACE_GUTTER_PX = 16

/** Breathing room under the last row, on top of whatever inset the caller reserves. */
const SURFACE_TRAILING_PX = 24

export type SurfaceContentOptions = {
  /**
   * Points of shell chrome floating over the bottom edge, from `useBottomChrome`.
   *
   * Callers do not compute this and do not pass it down — `SurfaceScroll` / `SurfaceList` read
   * it from the shell themselves. See `features/shell/bottom-chrome` for why it stopped being
   * a prop.
   */
  bottomInset?: number
  /** Space between rows, in points. */
  gap?: number
  /**
   * Drop the horizontal gutter: content that is a slab rather than a stack of cards — a diff,
   * a source listing, a gallery of full-bleed tiles — draws its own left edge.
   */
  edgeToEdge?: boolean
  /** Space above the first row, in points. */
  paddingTop?: number
}

/**
 * The content-container style for a scrolling surface. **Not** a `contentContainerClassName`.
 *
 * `react-native-css` maps `contentContainerClassName` onto the `contentContainerStyle` prop, and
 * its merge only preserves both a class-derived style and an inline one when the target is
 * `style` itself — see `native/styles/index.ts`, the `config.target[0] === "style"` branch. Every
 * other target falls through to `{ ...left, ...right }`, so passing `contentContainerStyle`
 * alongside `contentContainerClassName` **silently deletes the whole class-derived style**.
 *
 * That is not theoretical: every list here reserves the tab bar through `contentContainerStyle`,
 * so every list was quietly losing its gutter, its row gap and its trailing padding, and rows ran
 * into the bezel. It fails silently and it fails invisibly — nothing warns, and the class looks
 * right in the source.
 *
 * So a scroll container that needs a dynamic inset expresses ALL of its content padding here, in
 * one object. The test refuses a container that passes both props.
 */
export function surfaceContentStyle({
  bottomInset = 0,
  edgeToEdge = false,
  gap,
  paddingTop,
}: SurfaceContentOptions = {}): ViewStyle {
  return {
    gap,
    paddingBottom: bottomInset + SURFACE_TRAILING_PX,
    paddingHorizontal: edgeToEdge ? 0 : SURFACE_GUTTER_PX,
    paddingTop,
  }
}
