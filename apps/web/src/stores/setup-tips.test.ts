import { beforeEach, describe, expect, it } from 'vitest'
import { hydrateSetupTips, useSetupTipsStore } from './setup-tips'

describe('setup-tips store', () => {
  beforeEach(() => {
    useSetupTipsStore.setState({ dismissed: {} })
  })

  it('dismisses per repo and tip', () => {
    expect(useSetupTipsStore.getState().isDismissed('/a', 'layers-kickoff')).toBe(false)
    useSetupTipsStore.getState().dismiss('/a', 'layers-kickoff')
    expect(useSetupTipsStore.getState().isDismissed('/a', 'layers-kickoff')).toBe(true)
    expect(useSetupTipsStore.getState().isDismissed('/a', 'scope-kickoff')).toBe(false)
    expect(useSetupTipsStore.getState().isDismissed('/b', 'layers-kickoff')).toBe(false)
  })
})

describe('hydrateSetupTips', () => {
  it('keeps a valid dismissal map', () => {
    expect(
      hydrateSetupTips({
        dismissed: { '/a': { 'layers-kickoff': true }, '/b': { 'scope-kickoff': true } },
      }),
    ).toEqual({
      dismissed: { '/a': { 'layers-kickoff': true }, '/b': { 'scope-kickoff': true } },
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
    expect(hydrateSetupTips({ dismissed: { '/a': { 'layers-kickoff': 1 } } })).toEqual({})
    expect(hydrateSetupTips({ dismissed: { '/a': { 'layers-kickoff': false } } })).toEqual({})
  })

  it('drops a retired tip id without un-dismissing its neighbours', () => {
    expect(
      hydrateSetupTips({
        dismissed: {
          '/a': { 'layers-kickoff': true, 'review-kickoff': true },
          '/b': { 'review-kickoff': true },
        },
      }),
    ).toEqual({ dismissed: { '/a': { 'layers-kickoff': true } } })
  })

  it('ignores keys from another build and a missing map', () => {
    expect(hydrateSetupTips({ dismissed: { '/a': { 'scope-kickoff': true } }, seen: 4 })).toEqual({
      dismissed: { '/a': { 'scope-kickoff': true } },
    })
    expect(hydrateSetupTips({ seen: 4 })).toEqual({})
  })
})
