import { usePreferencesStore } from '@renderer/stores/preferences'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { applyResolvedTheme, resolveTheme, subscribeResolvedTheme } from './theme'

/** A full MediaQueryList shape (assignable without casts) for a fixed `matches`. */
function fakeMedia(matches: boolean): MediaQueryList {
  return {
    matches,
    media: '(prefers-color-scheme: dark)',
    onchange: null,
    addListener: () => {},
    removeListener: () => {},
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => false,
  }
}

beforeEach(() => {
  usePreferencesStore.setState({ theme: 'system' })
})

afterEach(() => {
  vi.restoreAllMocks()
})

describe('resolveTheme', () => {
  it('returns the explicit mode for light/dark, ignoring the OS', () => {
    vi.spyOn(window, 'matchMedia').mockReturnValue(fakeMedia(true))
    expect(resolveTheme('light')).toBe('light')
    expect(resolveTheme('dark')).toBe('dark')
  })

  it('resolves system to the OS preference', () => {
    const spy = vi.spyOn(window, 'matchMedia')
    spy.mockReturnValue(fakeMedia(true))
    expect(resolveTheme('system')).toBe('dark')
    spy.mockReturnValue(fakeMedia(false))
    expect(resolveTheme('system')).toBe('light')
  })
})

describe('applyResolvedTheme', () => {
  it('toggles the dark class and color-scheme', () => {
    applyResolvedTheme('dark')
    expect(document.documentElement.classList.contains('dark')).toBe(true)
    expect(document.documentElement.style.colorScheme).toBe('dark')

    applyResolvedTheme('light')
    expect(document.documentElement.classList.contains('dark')).toBe(false)
    expect(document.documentElement.style.colorScheme).toBe('light')
  })
})

describe('subscribeResolvedTheme', () => {
  it('fires only when the resolved mode actually changes', () => {
    // OS is light (default test-setup matchMedia stub → matches:false), so
    // system resolves light.
    const seen: Array<'light' | 'dark'> = []
    const unsubscribe = subscribeResolvedTheme((mode) => seen.push(mode))

    const { setTheme } = usePreferencesStore.getState()
    setTheme('dark') // light → dark: fires
    setTheme('dark') // no change: deduped
    setTheme('light') // dark → light: fires
    setTheme('system') // OS light → resolved light: deduped

    unsubscribe()
    setTheme('dark') // after unsubscribe: no fire

    expect(seen).toEqual(['dark', 'light'])
  })
})
