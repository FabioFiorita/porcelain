import { beforeEach, describe, expect, it } from 'vitest'

import { useShellStore } from './shell-store'

/**
 * The tablet's Surfaces strip, as state.
 *
 * The panel beside the viewer used to show whatever surface a routed screen had last reported,
 * so there was nothing to test: one field, written from five places, and no way to have two
 * surfaces beside each other or none at all. This is the web client's `openTabs` / `sidebarTab`
 * pair, and the two rules worth pinning are the ones a reader notices immediately when they
 * break — the strip's ORDER, and where focus lands when a tab closes.
 */

const initial = useShellStore.getState()

describe('shell store surfaces', () => {
  beforeEach(() => {
    useShellStore.setState({
      activeSurface: initial.activeSurface,
      openSurfaces: initial.openSurfaces,
    })
  })

  it('opens with the pair the review loop starts from', () => {
    expect(useShellStore.getState().openSurfaces).toEqual(['files', 'changes'])
    expect(useShellStore.getState().activeSurface).toBe('files')
  })

  it('keeps the strip in rail order, never insertion order', () => {
    // Canvas is last on the rail and History is third; opening them backwards must still read
    // Files · Changes · History · Canvas, or the same two tabs sit in two different places
    // depending on which one you happened to open first.
    useShellStore.getState().openSurface('canvas')
    useShellStore.getState().openSurface('history')
    expect(useShellStore.getState().openSurfaces).toEqual(['files', 'changes', 'history', 'canvas'])
    expect(useShellStore.getState().activeSurface).toBe('history')
  })

  it('raises a surface that is already open rather than doubling it', () => {
    useShellStore.getState().openSurface('changes')
    expect(useShellStore.getState().openSurfaces).toEqual(['files', 'changes'])
    expect(useShellStore.getState().activeSurface).toBe('changes')
  })

  it('falls back to the tab on the left when the active one closes', () => {
    useShellStore.getState().openSurface('history')
    useShellStore.getState().closeSurface('history')
    expect(useShellStore.getState().activeSurface).toBe('changes')
    expect(useShellStore.getState().openSurfaces).toEqual(['files', 'changes'])
  })

  it('leaves the showing tab alone when a different one closes', () => {
    useShellStore.getState().setActiveSurface('files')
    useShellStore.getState().closeSurface('changes')
    expect(useShellStore.getState().activeSurface).toBe('files')
  })

  it('empties to the launcher rather than to a surface nobody opened', () => {
    useShellStore.getState().setOpenSurfaces([])
    expect(useShellStore.getState().openSurfaces).toEqual([])
    // Null is the launcher. The field was non-null and defaulted to `files`, which is how the
    // panel ended up always showing something whether or not it had been asked to.
    expect(useShellStore.getState().activeSurface).toBeNull()
  })

  it('keeps showing the same surface when the strip is trimmed around it', () => {
    useShellStore.getState().openSurface('git')
    useShellStore.getState().setActiveSurface('changes')
    useShellStore.getState().setOpenSurfaces(['changes', 'git'])
    expect(useShellStore.getState().activeSurface).toBe('changes')
  })

  it('activates what a trim asks for', () => {
    useShellStore.getState().setOpenSurfaces(['git'], 'git')
    expect(useShellStore.getState().openSurfaces).toEqual(['git'])
    expect(useShellStore.getState().activeSurface).toBe('git')
  })

  it('ignores a close for a surface that is not open', () => {
    const before = useShellStore.getState().openSurfaces
    useShellStore.getState().closeSurface('canvas')
    expect(useShellStore.getState().openSurfaces).toBe(before)
  })
})
