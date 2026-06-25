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

describe('usePreferencesStore — lspEnabled', () => {
  beforeEach(() => usePreferencesStore.setState({ lspEnabled: false }))

  it('defaults to false', () => {
    expect(usePreferencesStore.getState().lspEnabled).toBe(false)
  })

  it('setLspEnabled toggles the value', () => {
    usePreferencesStore.getState().setLspEnabled(true)
    expect(usePreferencesStore.getState().lspEnabled).toBe(true)
  })
})
