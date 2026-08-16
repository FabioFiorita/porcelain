import type { SessionChange } from '@porcelain/contracts/session'
import { beforeEach, describe, expect, it } from 'vitest'
import { usePreferencesStore } from './preferences'
import { isUnreadTab, type UnreadTab, unreadTabFor, useUnreadStore } from './unread'

const PROJECT = '/synthetic/repo'

describe('useUnreadStore', () => {
  beforeEach(() => {
    useUnreadStore.setState({
      unread: {
        review: false,
        tasks: false,
        terminal: false,
        changes: false,
      },
    })
    usePreferencesStore.setState({ sidebarTab: 'files' })
  })

  it('mark sets the dot', () => {
    useUnreadStore.getState().mark('tasks')
    expect(useUnreadStore.getState().unread.tasks).toBe(true)
  })

  it('clear unsets the dot', () => {
    useUnreadStore.getState().mark('tasks')
    useUnreadStore.getState().clear('tasks')
    expect(useUnreadStore.getState().unread.tasks).toBe(false)
  })

  it('mark on the active tab no-ops', () => {
    usePreferencesStore.setState({ sidebarTab: 'tasks' })
    useUnreadStore.getState().mark('tasks')
    expect(useUnreadStore.getState().unread.tasks).toBe(false)
  })

  it('visiting a tab clears its dot (the one clearing site)', () => {
    useUnreadStore.getState().mark('review')
    usePreferencesStore.getState().setSidebarTab('review')
    expect(useUnreadStore.getState().unread.review).toBe(false)
  })
})

describe('unreadTabFor', () => {
  const cases: [SessionChange, UnreadTab | null][] = [
    [{ kind: 'review.changed', projectPath: PROJECT }, 'review'],
    [{ kind: 'board.changed', projectPath: PROJECT }, null],
    // Daemon-wide: the Tasks change carries no project and still marks the Tasks tab.
    [{ kind: 'tasks.changed' }, 'tasks'],
    // Project-scoped: the Actions change names a Project id, never a checkout path.
    [{ kind: 'actions.changed', projectId: 'proj-alpha' }, 'terminal'],
    [
      { kind: 'files.content-changed', projectPath: PROJECT, paths: [`${PROJECT}/a.ts`] },
      'changes',
    ],
    [{ kind: 'files.tree-changed', projectPath: PROJECT, paths: [`${PROJECT}/src`] }, 'changes'],
    [{ kind: 'git.working-tree-changed', projectPath: PROJECT }, 'changes'],
    [{ kind: 'files.scope-changed', projectPath: PROJECT }, null],
  ]

  for (const [change, expected] of cases) {
    it(`maps ${change.kind} → ${expected}`, () => {
      expect(unreadTabFor(change)).toBe(expected)
    })
  }
})

describe('isUnreadTab', () => {
  it('accepts the unread-capable tabs', () => {
    expect(isUnreadTab('review')).toBe(true)
    expect(isUnreadTab('tasks')).toBe(true)
    expect(isUnreadTab('terminal')).toBe(true)
    expect(isUnreadTab('changes')).toBe(true)
  })

  it('rejects the other rail tabs', () => {
    expect(isUnreadTab('files')).toBe(false)
    expect(isUnreadTab('search')).toBe(false)
  })
})
