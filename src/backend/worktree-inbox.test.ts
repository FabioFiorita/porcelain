import { describe, expect, it } from 'vitest'
import type { Worktree } from './diff'
import { assembleWorktreeInbox, type WorktreeInboxDeps } from './worktree-inbox'

// Build injectable deps from plain per-path maps so each case declares only its signal.
function deps(config: {
  worktrees: Worktree[]
  changed?: Record<string, number>
  review?: Record<string, boolean>
  throwOn?: Set<string>
}): WorktreeInboxDeps {
  return {
    listWorktrees: async () => config.worktrees,
    changedCount: async (path) => {
      if (config.throwOn?.has(path)) throw new Error('broken worktree dir')
      return config.changed?.[path] ?? 0
    },
    hasReview: async (path) => config.review?.[path] ?? false,
  }
}

describe('assembleWorktreeInbox', () => {
  it('drops the current checkout and keeps other worktrees with a changed-file signal', async () => {
    const rows = await assembleWorktreeInbox(
      '/repo',
      deps({
        worktrees: [
          { path: '/repo', branch: 'main' },
          { path: '/repo-worktrees/feat', branch: 'feature/x' },
        ],
        changed: { '/repo': 5, '/repo-worktrees/feat': 3 },
      }),
    )
    expect(rows).toEqual([
      {
        path: '/repo-worktrees/feat',
        branch: 'feature/x',
        changedCount: 3,
        hasReview: false,
      },
    ])
  })

  it('omits a worktree with neither changed files nor a review', async () => {
    const rows = await assembleWorktreeInbox(
      '/repo',
      deps({
        worktrees: [
          { path: '/repo', branch: 'main' },
          { path: '/repo-worktrees/quiet', branch: 'quiet' },
        ],
      }),
    )
    expect(rows).toEqual([])
  })

  it('includes a worktree whose only signal is a pushed review', async () => {
    const path = '/repo-worktrees/reviewed'
    const rows = await assembleWorktreeInbox(
      '/repo',
      deps({
        worktrees: [
          { path: '/repo', branch: 'main' },
          { path, branch: 'reviewed' },
        ],
        review: { [path]: true },
      }),
    )
    expect(rows).toEqual([{ path, branch: 'reviewed', changedCount: 0, hasReview: true }])
  })

  it('skips a worktree whose probe throws (deleted checkout git still lists) without failing the inbox', async () => {
    const rows = await assembleWorktreeInbox(
      '/repo',
      deps({
        worktrees: [
          { path: '/repo', branch: 'main' },
          { path: '/repo-worktrees/gone', branch: 'gone' },
          { path: '/repo-worktrees/live', branch: 'live' },
        ],
        changed: { '/repo-worktrees/live': 2 },
        throwOn: new Set(['/repo-worktrees/gone']),
      }),
    )
    expect(rows.map((row) => row.path)).toEqual(['/repo-worktrees/live'])
  })
})
