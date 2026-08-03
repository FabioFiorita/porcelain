import { beforeEach, describe, expect, it } from 'vitest'
import { usePreferencesStore } from './preferences'

describe('usePreferencesStore — pullMode', () => {
  beforeEach(() => usePreferencesStore.setState({ pullMode: 'merge' }))

  it('defaults to merge', () => {
    expect(usePreferencesStore.getState().pullMode).toBe('merge')
  })

  it('setPullMode switches the strategy', () => {
    usePreferencesStore.getState().setPullMode('rebase')
    expect(usePreferencesStore.getState().pullMode).toBe('rebase')
  })
})
