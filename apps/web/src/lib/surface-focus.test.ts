import { usePreferencesStore } from '@renderer/stores/preferences'
import { useSurfaceSessionStore } from '@renderer/stores/surface-session'
import { beforeEach, describe, expect, it } from 'vitest'
import { isFilesSurfaceFocused, visibleSurfaceTab } from './surface-focus'

describe('visibleSurfaceTab', () => {
  it('treats an empty strip as the launcher, not Files', () => {
    expect(visibleSurfaceTab([], 'files')).toBeNull()
  })

  it('returns the selected open surface', () => {
    expect(visibleSurfaceTab(['files', 'changes'], 'changes')).toBe('changes')
    expect(visibleSurfaceTab(['files'], 'files')).toBe('files')
  })
})

describe('isFilesSurfaceFocused', () => {
  beforeEach(() => {
    usePreferencesStore.setState({ sidebarTab: 'files' })
    useSurfaceSessionStore.setState({ openTabs: [] })
  })

  it('is false on the default landing while the launcher is showing', () => {
    expect(usePreferencesStore.getState().sidebarTab).toBe('files')
    expect(isFilesSurfaceFocused()).toBe(false)
  })

  it('is true only while the Files surface is the visible one', () => {
    useSurfaceSessionStore.getState().setOpenTabs(['files'])
    expect(isFilesSurfaceFocused()).toBe(true)
    usePreferencesStore.getState().setSidebarTab('changes')
    useSurfaceSessionStore.getState().setOpenTabs(['files', 'changes'])
    expect(isFilesSurfaceFocused()).toBe(false)
  })
})
