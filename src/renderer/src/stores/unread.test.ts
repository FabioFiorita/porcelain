import type { AppEvent } from '@shared/ws-protocol'
import { beforeEach, describe, expect, it } from 'vitest'
import { usePreferencesStore } from './preferences'
import { isUnreadTab, type UnreadTab, unreadTabFor, useUnreadStore } from './unread'

describe('useUnreadStore', () => {
  beforeEach(() => {
    useUnreadStore.setState({ unread: { feature: false, board: false, terminal: false } })
    usePreferencesStore.setState({ sidebarTab: 'files' })
  })

  it('mark sets the dot', () => {
    useUnreadStore.getState().mark('board')
    expect(useUnreadStore.getState().unread.board).toBe(true)
  })

  it('clear unsets the dot', () => {
    useUnreadStore.getState().mark('board')
    useUnreadStore.getState().clear('board')
    expect(useUnreadStore.getState().unread.board).toBe(false)
  })

  it('mark on the active tab no-ops', () => {
    usePreferencesStore.setState({ sidebarTab: 'board' })
    useUnreadStore.getState().mark('board')
    expect(useUnreadStore.getState().unread.board).toBe(false)
  })

  it('visiting a tab clears its dot (the one clearing site)', () => {
    useUnreadStore.getState().mark('feature')
    usePreferencesStore.getState().setSidebarTab('feature')
    expect(useUnreadStore.getState().unread.feature).toBe(false)
  })
})

describe('unreadTabFor', () => {
  const cases: [AppEvent, UnreadTab | null][] = [
    ['feature-view', 'feature'],
    ['artifact', 'feature'],
    ['comments', 'feature'],
    ['board', 'board'],
    ['actions', 'terminal'],
    ['layers', null],
    ['working-tree', null],
    ['file-tree', null],
  ]

  for (const [event, expected] of cases) {
    it(`maps ${event} → ${expected}`, () => {
      expect(unreadTabFor(event)).toBe(expected)
    })
  }

  it('maps an unknown event → null', () => {
    expect(unreadTabFor('nonsense' as AppEvent)).toBe(null)
  })
})

describe('isUnreadTab', () => {
  it('accepts the three unread-capable tabs', () => {
    expect(isUnreadTab('feature')).toBe(true)
    expect(isUnreadTab('board')).toBe(true)
    expect(isUnreadTab('terminal')).toBe(true)
  })

  it('rejects the other rail tabs', () => {
    expect(isUnreadTab('files')).toBe(false)
    expect(isUnreadTab('search')).toBe(false)
  })
})
