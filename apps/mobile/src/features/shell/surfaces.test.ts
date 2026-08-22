import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

import { SURFACES, surfaceById } from './surfaces'

/**
 * The ratchet on "the mobile client is the web client's companion".
 *
 * Mobile listed four surfaces where web listed six. Git and Canvas were not missing from the
 * app — they were screens the Worktree list pushed, unknown to the shell — so neither could
 * appear in the tablet's panel, and the quick-open palette's `switch` over surfaces silently did
 * nothing for both. Nobody noticed because nothing compared the two lists.
 *
 * This does. The web rail is the source: its `SURFACES` is read off disk and the ids, their
 * order and their one-line hints have to match. A surface added to the desktop and not to this
 * client fails here, which is the only place the drift is visible before a human finds it on an
 * iPad.
 */

const WEB_RAIL = join(
  __dirname,
  '..',
  '..',
  '..',
  '..',
  'web',
  'src',
  'components',
  'shell',
  'surface-sidebar.tsx',
)

/** `SURFACES` from the web rail: the ids in declaration order, with their hints. */
function webRail(): { id: string; hint: string }[] {
  const source = readFileSync(WEB_RAIL, 'utf8')
  const block = /export const SURFACES: SurfaceDefinition\[\] = \[([\s\S]*?)\n\]/.exec(source)?.[1]
  if (block === undefined) throw new Error(`No SURFACES array found in ${WEB_RAIL}`)

  const entries: { id: string; hint: string }[] = []
  for (const entry of block.split(/\},?\s*\{/)) {
    const id = /\bid:\s*'([^']+)'/.exec(entry)?.[1]
    const hint = /\bhint:\s*'([^']+)'/.exec(entry)?.[1]
    if (id !== undefined && hint !== undefined) entries.push({ hint, id })
  }
  return entries
}

describe('surfaces', () => {
  it('is the web rail’s set, in the web rail’s order', () => {
    expect(SURFACES.map((surface) => surface.id)).toEqual(webRail().map((entry) => entry.id))
  })

  it('describes each surface the way the desktop describes it', () => {
    const hints = new Map(webRail().map((entry) => [entry.id, entry.hint]))
    expect(SURFACES.map((surface) => [surface.id, surface.hint])).toEqual(
      SURFACES.map((surface) => [surface.id, hints.get(surface.id)]),
    )
  })

  it('gives every surface its own route', () => {
    const routes = SURFACES.map((surface) => String(surface.route))
    expect(new Set(routes).size).toBe(SURFACES.length)
    // A surface reached by pushing nothing is a row that does not work — the shape the rows in
    // `worktree-screen` and the palette's `navigateSurface` both rely on.
    expect(routes.every((route) => route.startsWith('/'))).toBe(true)
  })

  it('resolves a known id and falls back rather than throwing', () => {
    expect(surfaceById('canvas').label).toBe('Canvas')
    expect(surfaceById('git').route).toBe('/git')
  })
})
