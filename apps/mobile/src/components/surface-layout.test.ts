import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

import { SURFACE_GUTTER, SURFACE_GUTTER_PX } from './surface-layout'

/**
 * Two ratchets on the same surface, both earned by a bug that shipped.
 *
 * The gutter one: every phone surface once picked its own horizontal padding — 16pt header, 12pt
 * toolbar, 8pt list — and three left edges down one screen is what makes a build look unfinished.
 *
 * The dual-prop one is the expensive one. `react-native-css` maps `contentContainerClassName`
 * onto the `contentContainerStyle` prop, and only the `style` target merges a class-derived
 * style with an inline one; every other target overwrites. So a list that passed both lost its
 * ENTIRE class-derived style — gutter, row gap, trailing padding — with no warning, no type
 * error, and source that still reads correctly. It survived a full review and a round of
 * emulator screenshots before a human spotted it. A test is the only thing that catches it.
 *
 * A pane that genuinely is not a surface — an icon rail, a mock placeholder — opts out with a
 * `surface-gutter-allow` comment stating why, the same shape as `nativewind-allow-style`.
 */

const FEATURES = join(__dirname, '..', 'features')
const ALLOW = 'surface-gutter-allow'

function sourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((entry) => {
    const path = join(dir, entry)
    if (statSync(path).isDirectory()) return sourceFiles(path)
    return entry.endsWith('.tsx') ? [path] : []
  })
}

/** The JSX props of the element a match sits in — enough to see its sibling props. */
function elementAround(source: string, index: number): string {
  return source.slice(Math.max(0, index - 600), Math.min(source.length, index + 600))
}

describe('surface layout', () => {
  it('never pairs contentContainerClassName with contentContainerStyle', () => {
    const offenders: string[] = []

    for (const path of sourceFiles(FEATURES)) {
      const source = readFileSync(path, 'utf8')
      for (const match of source.matchAll(/contentContainerClassName[={]/g)) {
        const element = elementAround(source, match.index)
        if (!element.includes('contentContainerStyle')) continue
        offenders.push(path.slice(FEATURES.length + 1))
      }
    }

    // `contentContainerStyle` wins outright — the class-derived padding is silently dropped.
    // Put every content padding in `surfaceContentStyle()` instead.
    expect(offenders).toEqual([])
  })

  it('is the only horizontal padding a scroll container sets', () => {
    const offenders: string[] = []

    for (const path of sourceFiles(FEATURES)) {
      const source = readFileSync(path, 'utf8')
      for (const match of source.matchAll(/contentContainerClassName="([^"]*)"/g)) {
        const gutters = (match[1] ?? '').split(/\s+/).filter((token) => token.startsWith('px-'))
        if (!gutters.some((token) => token !== SURFACE_GUTTER)) continue
        if (elementAround(source, match.index).includes(ALLOW)) continue
        offenders.push(`${path.slice(FEATURES.length + 1)}: ${gutters.join(' ')}`)
      }
    }

    expect(offenders).toEqual([])
  })

  /**
   * The bottom-chrome ratchet.
   *
   * The floating tab bar used to be reserved by hand at every call site: a `bottomInset` number
   * threaded through as many as five layers of props to reach the list that needed it. It cost
   * two shipped bugs — a hardcoded tab bar height added on top of an `insets.bottom` that
   * ALREADY included the bar (133pt reserved for 81pt of chrome, app-wide), and the same hook
   * called inside bodies the iPad shares, where there is no tab bar at all.
   *
   * `SurfaceScroll` / `SurfaceList` read the shell themselves, so the number has no reason to
   * travel. A surface that reintroduces the prop is reintroducing the bug.
   */
  it('never threads a bottom inset through props', () => {
    const offenders: string[] = []

    for (const path of sourceFiles(FEATURES)) {
      const name = path.slice(FEATURES.length + 1)
      // The floating comment bar is anchored, not scrolled: it takes the value as a prop
      // because it has no content container to put it in.
      if (name === 'comments/selection-bar.tsx') continue
      const source = readFileSync(path, 'utf8')
      if (/bottomInset\??:\s*number/.test(source)) offenders.push(name)
    }

    // Read it from the shell instead: `SurfaceScroll` / `SurfaceList` already do, and a
    // component that anchors to the bottom edge by hand calls `useBottomChrome()` itself.
    expect(offenders).toEqual([])
  })

  it('leaves content padding to the surface primitives', () => {
    const offenders: string[] = []

    for (const path of sourceFiles(FEATURES)) {
      const source = readFileSync(path, 'utf8')
      for (const match of source.matchAll(/contentContainerStyle=\{\{/g)) {
        if (elementAround(source, match.index).includes(ALLOW)) continue
        offenders.push(path.slice(FEATURES.length + 1))
      }
    }

    // An inline content-container object skips `surfaceContentStyle`, so it silently drops the
    // gutter and the trailing padding every other list has. Use `SurfaceScroll` / `SurfaceList`.
    expect(offenders).toEqual([])
  })

  it('keeps the spacing scale pinned to points, not rem', () => {
    // Comments stripped first — the declaration's own note names the default it replaces.
    const css = readFileSync(join(__dirname, '..', 'global.css'), 'utf8').replace(
      /\/\*[\s\S]*?\*\//g,
      '',
    )
    const spacing = /--spacing:\s*([^;]+);/.exec(css)?.[1]?.trim()

    // Tailwind's default is `0.25rem`, and react-native-css hardcodes the runtime rem to 14 —
    // so every spacing utility silently measures 0.875x its name and `min-h-11` stops being a
    // 44pt touch target. An absolute unit is what makes `px-4` and SURFACE_GUTTER_PX agree.
    expect(spacing).toBe('4px')
    expect(SURFACE_GUTTER_PX).toBe(16)
  })
})
