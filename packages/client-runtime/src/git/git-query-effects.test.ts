import { describe, expect, it } from 'vitest'

import { gitDiffReadingQuery, gitFlowQuery, gitRangeFlowQuery } from './git-queries'
import { gitQueryEffectMatchesQuery } from './git-query-effects'

const PROJECT = '/synthetic/repo'

/**
 * A reviewer can compare their branch against any ref, so one project holds several
 * branch-range identities at once. The invalidation table cannot enumerate them —
 * it only knows "the branch view moved" — so a base-less effect has to sweep them all.
 */
describe('branch-range effects are base-agnostic', () => {
  it('invalidates every cached base when the effect names none', () => {
    const effect = gitRangeFlowQuery(PROJECT)
    for (const base of [undefined, 'origin/main', 'develop', '@{u}']) {
      expect(gitQueryEffectMatchesQuery(gitRangeFlowQuery(PROJECT, base), effect)).toBe(true)
    }
  })

  it('invalidates only the named base when the effect names one', () => {
    const effect = gitRangeFlowQuery(PROJECT, 'develop')
    expect(gitQueryEffectMatchesQuery(gitRangeFlowQuery(PROJECT, 'develop'), effect)).toBe(true)
    expect(gitQueryEffectMatchesQuery(gitRangeFlowQuery(PROJECT, 'origin/main'), effect)).toBe(
      false,
    )
    expect(gitQueryEffectMatchesQuery(gitRangeFlowQuery(PROJECT), effect)).toBe(false)
  })

  it('does not leak across projects, names, or scopes', () => {
    const effect = gitRangeFlowQuery(PROJECT)
    expect(gitQueryEffectMatchesQuery(gitRangeFlowQuery('/other/repo', 'develop'), effect)).toBe(
      false,
    )
    expect(gitQueryEffectMatchesQuery(gitFlowQuery(PROJECT), effect)).toBe(false)
  })

  it('sweeps branch readings of any base but leaves working and commit readings alone', () => {
    const effect = gitDiffReadingQuery(PROJECT, { type: 'branch' })
    expect(
      gitQueryEffectMatchesQuery(
        gitDiffReadingQuery(PROJECT, { type: 'branch', base: 'develop' }),
        effect,
      ),
    ).toBe(true)
    expect(
      gitQueryEffectMatchesQuery(gitDiffReadingQuery(PROJECT, { type: 'working' }), effect),
    ).toBe(false)
    expect(
      gitQueryEffectMatchesQuery(
        gitDiffReadingQuery(PROJECT, { type: 'commit', hash: 'abc' }),
        effect,
      ),
    ).toBe(false)
  })
})
