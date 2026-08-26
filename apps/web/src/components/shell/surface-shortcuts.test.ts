import { describe, expect, it } from 'vitest'
import { SURFACES } from './surface-sidebar'
import { SIDEBAR_TAB_KEYS } from './use-app-shortcuts'

describe('surface shortcuts', () => {
  it('displays the canonical shortcut for every surface', () => {
    expect(Object.fromEntries(SURFACES.map((surface) => [surface.id, surface.shortcut]))).toEqual({
      files: '1',
      changes: '2',
      git: '3',
      history: '4',
      canvas: '5',
    })
    expect(SURFACES.map((surface) => surface.id)).toEqual([
      'files',
      'changes',
      'git',
      'history',
      'canvas',
    ])
  })

  it('routes every displayed shortcut to its surface; terminal is ⌘J, not a numbered slot', () => {
    expect(SIDEBAR_TAB_KEYS).toEqual({
      '1': 'files',
      '2': 'changes',
      '3': 'git',
      '4': 'history',
      '5': 'canvas',
    })
    expect(SIDEBAR_TAB_KEYS['6']).toBeUndefined()
    expect(SIDEBAR_TAB_KEYS['7']).toBeUndefined()
  })
})
