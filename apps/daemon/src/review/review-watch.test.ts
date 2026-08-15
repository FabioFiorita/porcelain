// @vitest-environment node
import { describe, expect, it, vi } from 'vitest'

const REPO = '/synthetic/repo'
/** A second Project, so each test gets a watcher registry entry of its own. */
const OTHER_REPO = '/synthetic/other-repo'
const callbacks = vi.hoisted(() => new Map<string, (event: string, filename: string) => void>())
const state = vi.hoisted(() => ({ activeReviewExists: false }))
const publishSessionChange = vi.hoisted(() => vi.fn())
const mkdir = vi.hoisted(() => vi.fn(async (_path: string) => undefined))

vi.mock('node:fs', () => ({
  watch: vi.fn((path: string, callback: (event: string, filename: string) => void) => {
    if (path.endsWith('/active-review') && !state.activeReviewExists) {
      throw new Error('ENOENT')
    }
    callbacks.set(path, callback)
    return { close: vi.fn() }
  }),
}))

vi.mock('node:fs/promises', () => ({
  mkdir,
  stat: vi.fn(async (path: string) => {
    const roots = [REPO, OTHER_REPO]
    if (roots.some((root) => path === root || path === `${root}/.porcelain`)) {
      return { isDirectory: () => true }
    }
    throw new Error('ENOENT')
  }),
}))

vi.mock('../session/live-session', () => ({ publishSessionChange }))
vi.mock('../features/projects', () => ({
  configuredProjectsRecentsStore: vi.fn(() => ({
    readPaths: vi.fn(async () => ({ ok: true, value: [] })),
  })),
}))

import { syncProjectWatches } from './review-watch'

describe('review companion watcher', () => {
  it('attaches after active-review appears and emits one Review fact per comments write', async () => {
    await syncProjectWatches(REPO)
    expect(callbacks.has(`${REPO}/.porcelain/active-review`)).toBe(false)

    state.activeReviewExists = true
    callbacks.get(`${REPO}/.porcelain`)?.('rename', 'active-review')
    expect(callbacks.has(`${REPO}/.porcelain/active-review`)).toBe(true)
    expect(publishSessionChange).toHaveBeenCalledTimes(1)
    expect(publishSessionChange).toHaveBeenLastCalledWith({
      kind: 'review.changed',
      projectPath: REPO,
    })

    callbacks.get(`${REPO}/.porcelain/active-review`)?.('change', 'comments.json')
    expect(publishSessionChange).toHaveBeenCalledTimes(2)
    expect(publishSessionChange).toHaveBeenLastCalledWith({
      kind: 'review.changed',
      projectPath: REPO,
    })
  })

  it('creates no evidence directories until a review is actually in flight', async () => {
    // Watching an opened Project is a read. #26 made `.porcelain/` something a
    // human opts into by promoting, so a promoted repo that has never run a
    // review must not sprout `active-review/evidence/` just from being opened.
    mkdir.mockClear()
    state.activeReviewExists = false

    await syncProjectWatches(OTHER_REPO)
    expect(mkdir).not.toHaveBeenCalled()

    state.activeReviewExists = true
    callbacks.get(`${OTHER_REPO}/.porcelain`)?.('rename', 'active-review')
    expect(mkdir.mock.calls.map(([path]) => path)).toEqual([
      `${OTHER_REPO}/.porcelain/active-review/evidence`,
      `${OTHER_REPO}/.porcelain/active-review/evidence/results`,
      `${OTHER_REPO}/.porcelain/active-review/evidence/assets`,
    ])
  })
})
