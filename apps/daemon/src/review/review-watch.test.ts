import { describe, expect, it, vi } from 'vitest'

vi.mock('../features/projects', () => ({
  configuredProjectsRecentsStore: () => ({ readPaths: async () => ({ ok: true, value: [] }) }),
}))

import { syncProjectWatches } from './review-watch'

describe('Review companion watcher', () => {
  it('does not create or watch a production review lifecycle directory when no playground is recent', async () => {
    await expect(syncProjectWatches()).resolves.toBeUndefined()
  })
})
