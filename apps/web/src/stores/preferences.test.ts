import { beforeEach, describe, expect, it } from 'vitest'
import {
  hydratePreferences,
  NOTES_MAX_HEIGHT,
  NOTES_MIN_HEIGHT,
  RIGHT_SIDEBAR_MIN_WIDTH,
  SIDEBAR_MAX_WIDTH,
  SIDEBAR_MIN_WIDTH,
  SPLIT_MAX_RATIO,
  SPLIT_MIN_RATIO,
  usePreferencesStore,
} from './preferences'

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

/**
 * `localStorage` outlives every shape this store has had. These cover what rehydration
 * must survive: a corrupt blob, a stale vocabulary, keys from a newer build, and one bad
 * field sitting beside good ones.
 */
describe('hydratePreferences', () => {
  it('keeps a fully valid blob, applying the setters’ clamps', () => {
    expect(
      hydratePreferences({
        theme: 'dark',
        changesScope: 'branch',
        diffMode: 'split',
        markdownMode: 'source',
        htmlMode: 'source',
        pullMode: 'rebase',
        commitModel: 'opus',
        rightSidebarOpen: false,
        rightSidebarWidth: 400,
        sidebarTab: 'canvas',
        sidebarWidth: 360,
        notesHeight: 300,
        splitRatio: 0.35,
        skillsDismissedVersion: '0.51.0',
      }),
    ).toEqual({
      theme: 'dark',
      changesScope: 'branch',
      diffMode: 'split',
      markdownMode: 'source',
      htmlMode: 'source',
      pullMode: 'rebase',
      commitModel: 'opus',
      rightSidebarOpen: false,
      rightSidebarWidth: 400,
      sidebarTab: 'canvas',
      sidebarWidth: 360,
      notesHeight: 300,
      splitRatio: 0.35,
      // `skillsDismissedVersion` was the skills-upgrade nag; the plugin marketplace owns
      // updates now, so a blob still carrying it must not resurrect the field.
    })
  })

  it('returns nothing for a corrupt blob', () => {
    for (const corrupt of [null, undefined, 'porcelain-preferences', 42, true]) {
      expect(hydratePreferences(corrupt), String(corrupt)).toEqual({})
    }
    // An array is an object, but carries no preference keys.
    expect(hydratePreferences(['dark'])).toEqual({})
  })

  it('drops only the invalid fields and keeps every valid neighbour', () => {
    expect(
      hydratePreferences({
        theme: 'sepia',
        diffMode: 'split',
        sidebarWidth: 'wide',
        notesHeight: 300,
        commitModel: '',
        splitRatio: null,
      }),
    ).toEqual({ diffMode: 'split', notesHeight: 300 })
  })

  it('falls back from retired sidebar tabs and ignores unknown keys', () => {
    expect(hydratePreferences({ sidebarTab: 'tasks', pullMode: 'rebase' })).toEqual({
      pullMode: 'rebase',
    })
    expect(hydratePreferences({ sidebarTab: 'git' })).toEqual({ sidebarTab: 'git' })
    expect(hydratePreferences({ sidebarTab: 'search' })).toEqual({})
    expect(hydratePreferences({ sidebarTab: 'board', pullMode: 'rebase' })).toEqual({
      pullMode: 'rebase',
    })
    expect(hydratePreferences({ sidebarTab: 'evidence', pullMode: 'rebase' })).toEqual({
      pullMode: 'rebase',
    })
    expect(hydratePreferences({ theme: 'light', zenMode: true, layers: ['a'] })).toEqual({
      theme: 'light',
    })
  })

  it('never lets a non-finite or out-of-range dimension through', () => {
    expect(hydratePreferences({ sidebarWidth: Number.NaN })).toEqual({})
    expect(hydratePreferences({ sidebarWidth: Number.POSITIVE_INFINITY })).toEqual({})
    expect(hydratePreferences({ notesHeight: Number.NEGATIVE_INFINITY })).toEqual({})
    expect(hydratePreferences({ sidebarWidth: 10 })).toEqual({ sidebarWidth: SIDEBAR_MIN_WIDTH })
    expect(hydratePreferences({ sidebarWidth: 9000 })).toEqual({ sidebarWidth: SIDEBAR_MAX_WIDTH })
    expect(hydratePreferences({ rightSidebarWidth: 0 })).toEqual({
      rightSidebarWidth: RIGHT_SIDEBAR_MIN_WIDTH,
    })
    expect(hydratePreferences({ notesHeight: 5 })).toEqual({ notesHeight: NOTES_MIN_HEIGHT })
    expect(hydratePreferences({ notesHeight: 5000 })).toEqual({ notesHeight: NOTES_MAX_HEIGHT })
    expect(hydratePreferences({ splitRatio: -3 })).toEqual({ splitRatio: SPLIT_MIN_RATIO })
    expect(hydratePreferences({ splitRatio: 3 })).toEqual({ splitRatio: SPLIT_MAX_RATIO })
  })
})
