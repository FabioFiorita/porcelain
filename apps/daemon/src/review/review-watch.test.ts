// @vitest-environment node
import { describe, expect, it, vi } from 'vitest'

const REPO = '/synthetic/repo'
const callbacks = vi.hoisted(() => new Map<string, (event: string, filename: string) => void>())
const state = vi.hoisted(() => ({ activeReviewExists: false }))
const publishSessionChange = vi.hoisted(() => vi.fn())

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
  mkdir: vi.fn(async () => undefined),
  stat: vi.fn(async (path: string) => {
    if (path === REPO || path === `${REPO}/.porcelain`) return { isDirectory: () => true }
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
})
