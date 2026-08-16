import { beforeEach, describe, expect, it } from 'vitest'
import { hydrateSetupTips, useSetupTipsStore } from './setup-tips'

describe('setup-tips store', () => {
  beforeEach(() => {
    useSetupTipsStore.setState({ dismissed: {} })
  })

  it('dismisses per repo and tip', () => {
    expect(useSetupTipsStore.getState().isDismissed('/a', 'scope-kickoff')).toBe(false)
    useSetupTipsStore.getState().dismiss('/a', 'scope-kickoff')
    expect(useSetupTipsStore.getState().isDismissed('/a', 'scope-kickoff')).toBe(true)
  })
})

describe('hydrateSetupTips', () => {
  it('keeps a valid dismissal map', () => {
    expect(
      hydrateSetupTips({
        dismissed: { '/a': { 'scope-kickoff': true }, '/b': { 'scope-kickoff': true } },
      }),
    ).toEqual({
      dismissed: { '/a': { 'scope-kickoff': true }, '/b': { 'scope-kickoff': true } },
    })
    expect(hydrateSetupTips({ dismissed: {} })).toEqual({ dismissed: {} })
  })

  it('falls back for a corrupt or structurally wrong map', () => {
    for (const corrupt of [
      null,
      undefined,
      'tips',
      3,
      { dismissed: null },
      { dismissed: ['/a'] },
    ]) {
      expect(hydrateSetupTips(corrupt), JSON.stringify(corrupt ?? null)).toEqual({})
    }
    // `=== true` must never be accidental.
    expect(hydrateSetupTips({ dismissed: { '/a': { 'scope-kickoff': 1 } } })).toEqual({})
    expect(hydrateSetupTips({ dismissed: { '/a': { 'scope-kickoff': false } } })).toEqual({})
  })

  it('drops a retired tip id without un-dismissing its neighbours', () => {
    expect(
      hydrateSetupTips({
        dismissed: {
          '/a': { 'scope-kickoff': true, 'retired-tip': true },
          '/b': { 'retired-tip': true },
        },
      }),
    ).toEqual({ dismissed: { '/a': { 'scope-kickoff': true } } })
  })

  it('ignores keys from another build and a missing map', () => {
    expect(hydrateSetupTips({ dismissed: { '/a': { 'scope-kickoff': true } }, seen: 4 })).toEqual({
      dismissed: { '/a': { 'scope-kickoff': true } },
    })
    expect(hydrateSetupTips({ seen: 4 })).toEqual({})
  })
})
