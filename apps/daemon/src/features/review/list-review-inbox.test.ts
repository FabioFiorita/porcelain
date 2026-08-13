// @vitest-environment node
import { describe, expect, it } from 'vitest'
import { createListReviewInbox } from './list-review-inbox'
import type { ReviewGit, ReviewReadingSources } from './review-reading-capabilities'

/**
 * Capability fakes built from plain per-path maps, so each case declares only its
 * signal. Nothing here reimplements git or the review store — the probes answer
 * from the case's own data, or throw where the case is about a broken checkout.
 */
function inbox(config: {
  worktrees: { path: string; branch: string }[]
  changed?: Record<string, number>
  review?: Record<string, boolean>
  throwOn?: Set<string>
}) {
  const git = {
    fileHunks: async () => [],
    listFiles: async () => [],
    worktrees: async () => config.worktrees,
    changedCount: async (path: string) => {
      if (config.throwOn?.has(path)) throw new Error('broken worktree dir')
      return config.changed?.[path] ?? 0
    },
  } satisfies ReviewGit
  const sources = {
    gather: async () => {
      throw new Error('the inbox never gathers')
    },
    build: async () => {
      throw new Error('the inbox never builds')
    },
    cachedReading: () => null,
    storeReading: () => undefined,
    hasReviewSet: async (path: string) => config.review?.[path] ?? false,
  } satisfies ReviewReadingSources
  return createListReviewInbox({ git, sources })
}

const REPO = '/synthetic/repo'

describe('listReviewInbox', () => {
  it('drops the current checkout and keeps other worktrees with a changed-file signal', async () => {
    const rows = await inbox({
      worktrees: [
        { path: REPO, branch: 'main' },
        { path: '/synthetic/worktrees/feat', branch: 'feature/x' },
      ],
      changed: { [REPO]: 5, '/synthetic/worktrees/feat': 3 },
    })({ projectPath: REPO })

    expect(rows).toEqual([
      { path: '/synthetic/worktrees/feat', branch: 'feature/x', changedCount: 3, hasReview: false },
    ])
  })

  it('omits a worktree with neither changed files nor a review', async () => {
    const rows = await inbox({
      worktrees: [
        { path: REPO, branch: 'main' },
        { path: '/synthetic/worktrees/quiet', branch: 'quiet' },
      ],
    })({ projectPath: REPO })

    expect(rows).toEqual([])
  })

  it('includes a worktree whose only signal is a pushed review', async () => {
    const path = '/synthetic/worktrees/reviewed'
    const rows = await inbox({
      worktrees: [
        { path: REPO, branch: 'main' },
        { path, branch: 'reviewed' },
      ],
      review: { [path]: true },
    })({ projectPath: REPO })

    expect(rows).toEqual([{ path, branch: 'reviewed', changedCount: 0, hasReview: true }])
  })

  it('skips a worktree whose probe throws (deleted checkout git still lists) without failing the inbox', async () => {
    const rows = await inbox({
      worktrees: [
        { path: REPO, branch: 'main' },
        { path: '/synthetic/worktrees/gone', branch: 'gone' },
        { path: '/synthetic/worktrees/live', branch: 'live' },
      ],
      changed: { '/synthetic/worktrees/live': 2 },
      throwOn: new Set(['/synthetic/worktrees/gone']),
    })({ projectPath: REPO })

    expect(rows.map((row) => row.path)).toEqual(['/synthetic/worktrees/live'])
  })
})
