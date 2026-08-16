import { describe, expect, it } from 'vitest'
import { SURFACES } from './surface-sidebar'
import { SIDEBAR_TAB_KEYS } from './use-app-shortcuts'

describe('surface shortcuts', () => {
  it('displays the canonical shortcut for every surface', () => {
    expect(Object.fromEntries(SURFACES.map((surface) => [surface.id, surface.shortcut]))).toEqual({
      files: '1',
      changes: '2',
      history: '3',
      search: '4',
      tasks: '5',
      canvas: '7',
    })
  })

  it('routes every displayed shortcut to its surface and reserves 6 for Terminal', () => {
    expect(SIDEBAR_TAB_KEYS).toEqual({
      '1': 'files',
      '2': 'changes',
      '3': 'history',
      '4': 'search',
      '5': 'tasks',
      '7': 'canvas',
    })
    expect(SIDEBAR_TAB_KEYS['6']).toBeUndefined()
  })
})
