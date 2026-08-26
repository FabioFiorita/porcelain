import { describe, expect, it } from 'vitest'
import type { SidebarTab } from './preferences'
import {
  closeOtherSurfaces,
  closeSurfacesToLeft,
  closeSurfacesToRight,
  hydrateSurfaceSession,
  moveSurface,
} from './surface-session'

const tabs: SidebarTab[] = ['files', 'changes', 'history', 'git']

describe('surface tab close and move', () => {
  it('keeps only the chosen tab when closing others', () => {
    expect(closeOtherSurfaces(tabs, 'history')).toEqual(['history'])
    expect(closeOtherSurfaces(tabs, 'canvas')).toEqual(tabs)
  })

  it('closes tabs to the left or right of the chosen tab', () => {
    expect(closeSurfacesToLeft(tabs, 'history')).toEqual(['history', 'git'])
    expect(closeSurfacesToLeft(tabs, 'files')).toEqual(tabs)
    expect(closeSurfacesToRight(tabs, 'changes')).toEqual(['files', 'changes'])
    expect(closeSurfacesToRight(tabs, 'git')).toEqual(tabs)
  })

  it('reorders a dragged tab onto another tab', () => {
    expect(moveSurface(tabs, 'git', 'files')).toEqual(['git', 'files', 'changes', 'history'])
    expect(moveSurface(tabs, 'files', 'history')).toEqual(['changes', 'history', 'files', 'git'])
    expect(moveSurface(tabs, 'files', 'files')).toEqual(tabs)
  })
})

describe('hydrateSurfaceSession', () => {
  it('keeps known surface tabs and drops the rest', () => {
    expect(
      hydrateSurfaceSession({ openTabs: ['changes', 'search', 'nope', 'files', 'changes'] }),
    ).toEqual({
      openTabs: ['changes', 'files'],
    })
  })

  it('returns an empty strip for a corrupt blob', () => {
    expect(hydrateSurfaceSession(null)).toEqual({ openTabs: [] })
    expect(hydrateSurfaceSession({ openTabs: 'files' })).toEqual({ openTabs: [] })
  })
})
