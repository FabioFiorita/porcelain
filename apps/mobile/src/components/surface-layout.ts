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
export const SURFACE_GUTTER = 'px-[16px]'

/**
 * The band directly under the header's divider — a toolbar, a segmented control, a summary.
 *
 * Its top padding mirrors the bottom padding the header spends above the divider. The two were
 * 10pt and 4pt, which is the kind of near-miss that looks like a rendering bug rather than a
 * choice.
 */
export const SURFACE_TOOLBAR = 'px-[16px] pb-[8px] pt-[12px]'

/** A note hanging under the toolbar: an error, an action failure, a loading line. */
export const SURFACE_NOTE = 'px-[16px] pb-[8px]'

/** Padding above the header's divider. Kept equal to `SURFACE_TOOLBAR`'s top padding. */
export const SURFACE_HEADER_BAND = 'px-[16px] pb-[12px]'

/**
 * `SURFACE_GUTTER` as a number, for the scroll containers that cannot use the class.
 *
 * The classes above spell the gutter `px-[16px]` rather than `px-4` so this number and that
 * class are the same 16pt. They were not: measured on device, `px-4` lands at 14pt — Tailwind's
 * spacing scale is rem-relative and the runtime rem here is not 16 — so a header written in
 * classes sat 2pt inside a list written in points. Two pixels is invisible in a diff and plainly
 * wrong on a screen. Anything that has to line up states its size in px on both sides.
 */
export const SURFACE_GUTTER_PX = 16

/** Breathing room under the last row, on top of whatever inset the caller reserves. */
const SURFACE_TRAILING_PX = 24

export type SurfaceContentOptions = {
  /** Room for the floating tab bar (and keyboard) the list scrolls under. */
  bottomInset?: number
  /** Space between rows, in points. */
  gap?: number
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
  gap,
  paddingTop,
}: SurfaceContentOptions = {}): ViewStyle {
  return {
    gap,
    paddingBottom: bottomInset + SURFACE_TRAILING_PX,
    paddingHorizontal: SURFACE_GUTTER_PX,
    paddingTop,
  }
}
