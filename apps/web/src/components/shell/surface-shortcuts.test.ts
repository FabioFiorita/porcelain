import { describe, expect, it } from 'vitest'
import { SURFACES } from './surface-sidebar'
import { SIDEBAR_TAB_KEYS } from './use-app-shortcuts'

describe('surface shortcuts', () => {
  it('displays the canonical shortcut for every surface', () => {
    expect(Object.fromEntries(SURFACES.map((surface) => [surface.id, surface.shortcut]))).toEqual({
      files: '1',
      changes: '2',
      history: '3',
      git: '5',
      search: '4',
      canvas: '7',
    })
    expect(SURFACES.map((surface) => surface.id)).toEqual([
      'files',
      'changes',
      'history',
      'git',
      'search',
      'canvas',
    ])
  })

  it('routes every displayed shortcut to its surface; terminal is ⌘J, not a numbered slot', () => {
    expect(SIDEBAR_TAB_KEYS).toEqual({
      '1': 'files',
      '2': 'changes',
      '3': 'history',
      '4': 'search',
      '5': 'git',
      '7': 'canvas',
    })
    expect(SIDEBAR_TAB_KEYS['6']).toBeUndefined()
  })
})
