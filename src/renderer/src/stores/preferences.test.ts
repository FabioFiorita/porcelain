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

describe('usePreferencesStore — terminalRenderer', () => {
  beforeEach(() => usePreferencesStore.setState({ terminalRenderer: 'webgl' }))

  it('defaults to webgl', () => {
    expect(usePreferencesStore.getState().terminalRenderer).toBe('webgl')
  })

  it('setTerminalRenderer switches the paint path', () => {
    usePreferencesStore.getState().setTerminalRenderer('dom')
    expect(usePreferencesStore.getState().terminalRenderer).toBe('dom')
  })
})

// Rehydration is the ONLY place a dead `sidebarTab` can enter the store: the union
// is narrowed at compile time, but localStorage holds untyped JSON written by an
// older build. Drive the real persist hook rather than asserting on the migration
// in isolation, so a rewrite of onRehydrateStorage can't quietly drop it.
describe('usePreferencesStore — rehydration', () => {
  beforeEach(() => {
    localStorage.clear()
    usePreferencesStore.setState({ sidebarTab: 'files' })
  })

  it('sends a persisted Agent tab home to Files', async () => {
    localStorage.setItem(
      'porcelain-preferences',
      JSON.stringify({ state: { sidebarTab: 'agent' }, version: 0 }),
    )
    await usePreferencesStore.persist.rehydrate()
    expect(usePreferencesStore.getState().sidebarTab).toBe('files')
  })

  it('sends a persisted Relay tab home to Files', async () => {
    localStorage.setItem(
      'porcelain-preferences',
      JSON.stringify({ state: { sidebarTab: 'chat' }, version: 0 }),
    )
    await usePreferencesStore.persist.rehydrate()
    expect(usePreferencesStore.getState().sidebarTab).toBe('files')
  })

  it('leaves a still-valid tab alone', async () => {
    localStorage.setItem(
      'porcelain-preferences',
      JSON.stringify({ state: { sidebarTab: 'terminal' }, version: 0 }),
    )
    await usePreferencesStore.persist.rehydrate()
    expect(usePreferencesStore.getState().sidebarTab).toBe('terminal')
  })
})
