import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

import { SURFACE_GUTTER } from './surface-layout'

/**
 * The gutter ratchet.
 *
 * Every phone surface once picked its own horizontal padding — 16pt for the header, 12pt for
 * the toolbar under it, 8pt for the list — and the three left edges are what made the build
 * read as unfinished. Fixing that by hand only holds until the next surface lands, so the rule
 * is a test: a scroll container that sets its own horizontal padding has to set the shared one.
 *
 * Deliberately narrow. It polices the *outermost* padding of scrolling content, which is the
 * one that decides where a surface's left edge falls. Row and card padding sits inside that
 * edge and is free to be whatever the row needs.
 *
 * A pane that genuinely is not a surface — an icon-only rail, a mock placeholder — opts out
 * with a `surface-gutter-allow` comment stating why, the same shape as the `nativewind-allow-style`
 * marker used elsewhere. An opt-out is reviewable; a silent exception list is not.
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

describe('surface gutter', () => {
  it('is the only horizontal padding a scroll container sets', () => {
    const offenders: string[] = []

    for (const path of sourceFiles(FEATURES)) {
      const source = readFileSync(path, 'utf8')
      for (const match of source.matchAll(/contentContainerClassName="([^"]*)"/g)) {
        const gutters = (match[1] ?? '').split(/\s+/).filter((token) => token.startsWith('px-'))
        if (!gutters.some((token) => token !== SURFACE_GUTTER)) continue
        // The marker sits on the container, so look back over the JSX props above the match.
        const before = source.slice(Math.max(0, match.index - 400), match.index)
        if (before.includes(ALLOW)) continue
        offenders.push(`${path.slice(FEATURES.length + 1)}: ${gutters.join(' ')}`)
      }
    }

    expect(offenders).toEqual([])
  })
})
