// @vitest-environment node
import { describe, expect, it } from 'vitest'
import type {
  ArchivedReviewMeta,
  ReviewArchiveStore,
  ReviewPublication,
} from './review-lifecycle-capabilities'
import { createReviewLifecycleOperations } from './review-lifecycle-operations'

const PROJECT = '/synthetic/repo'

type Recorder = {
  store: ReviewArchiveStore
  publication: ReviewPublication
  calls: string[]
  archives: Array<{ id: string; archivedAt: string }>
}

/**
 * In-memory capability fakes that record call order only — they never reimplement
 * the filesystem behavior the adapter test owns.
 */
function recorder(
  overrides: {
    archiveActive?: (id: string) => string | null
    activeCost?: () => { bytes: number; files: number }
    rejectOn?: string
    list?: ArchivedReviewMeta[]
    has?: boolean
  } = {},
): Recorder {
  const calls: string[] = []
  const archives: Array<{ id: string; archivedAt: string }> = []
  const guard = (name: string): void => {
    calls.push(name)
    if (overrides.rejectOn === name) throw new Error(`${name} failed`)
  }

  return {
    calls,
    archives,
    store: {
      async archiveActive(_repoPath, id, archivedAt) {
        guard('archiveActive')
        archives.push({ id, archivedAt })
        return overrides.archiveActive ? overrides.archiveActive(id) : id
      },
      async activeCost() {
        guard('activeCost')
        return overrides.activeCost?.() ?? { bytes: 2048, files: 3 }
      },
      async list() {
        guard('list')
        return overrides.list ?? []
      },
      async has(_repoPath, id) {
        guard(`has:${id}`)
        return overrides.has ?? true
      },
      async restore(_repoPath, id) {
        guard(`restore:${id}`)
      },
      async remove(_repoPath, id) {
        guard(`remove:${id}`)
      },
      archiveRelativePath(_repoPath, id) {
        return `.porcelain/reviews/${id}`
      },
    },
    publication: {
      async recordPublished() {
        guard('recordPublished')
      },
      async forceStage(_repoPath, relativePath) {
        guard(`forceStage:${relativePath}`)
      },
    },
  }
}

function operations(fakes: Recorder, ids = ['archive-1', 'archive-2']) {
  let index = 0
  return createReviewLifecycleOperations({
    store: fakes.store,
    publication: fakes.publication,
    clock: { now: () => 1_760_000_000_000 },
    ids: { create: () => ids[index++] ?? 'archive-overflow' },
  })
}

describe('review lifecycle operations', () => {
  it('publishes in cost → archive → record → stage order and returns the outcome', async () => {
    const fakes = recorder()

    await expect(operations(fakes).publishReview({ projectPath: PROJECT })).resolves.toEqual({
      ok: true,
      value: { id: 'archive-1', cost: { bytes: 2048, files: 3 } },
    })
    expect(fakes.calls).toEqual([
      'activeCost',
      'archiveActive',
      'recordPublished',
      'forceStage:.porcelain/reviews/archive-1',
    ])
  })

  it('publishes nothing as null without recording or staging', async () => {
    const fakes = recorder({ archiveActive: () => null })

    await expect(operations(fakes).publishReview({ projectPath: PROJECT })).resolves.toEqual({
      ok: true,
      value: null,
    })
    expect(fakes.calls).toEqual(['activeCost', 'archiveActive'])
  })

  it('archives silently when nothing is active, and reads cost and the archive list', async () => {
    const listed: ArchivedReviewMeta[] = [
      { id: 'a', name: 'Earlier review', archivedAt: '2026-08-09T00:00:00.000Z' },
    ]
    const fakes = recorder({ archiveActive: () => null, list: listed })
    const ops = operations(fakes)

    await expect(ops.archiveReview({ projectPath: PROJECT })).resolves.toEqual({
      ok: true,
      value: undefined,
    })
    await expect(ops.publishCost({ projectPath: PROJECT })).resolves.toEqual({
      ok: true,
      value: { bytes: 2048, files: 3 },
    })
    await expect(ops.archivedReviews({ projectPath: PROJECT })).resolves.toEqual({
      ok: true,
      value: listed,
    })
  })

  it('archives the active review before restoring, with an id and clock stamp of its own', async () => {
    const fakes = recorder()

    await expect(
      operations(fakes).restoreArchivedReview({ projectPath: PROJECT, id: 'old-1' }),
    ).resolves.toEqual({ ok: true, value: undefined })
    expect(fakes.calls).toEqual(['has:old-1', 'archiveActive', 'restore:old-1'])
    expect(fakes.archives).toEqual([{ id: 'archive-1', archivedAt: '2025-10-09T08:53:20.000Z' }])
  })

  // A restore that cannot land must leave the active review exactly where it was:
  // the legacy store proved the source existed before it archived anything.
  it('fails a restore of a missing archive without archiving the active review', async () => {
    const fakes = recorder({ has: false })

    await expect(
      operations(fakes).restoreArchivedReview({ projectPath: PROJECT, id: 'gone' }),
    ).resolves.toEqual({ ok: false, error: { code: 'review.unavailable' } })
    expect(fakes.calls).toEqual(['has:gone'])
    expect(fakes.archives).toEqual([])
  })

  it('stamps archive and restore archives from the same id and clock capabilities', async () => {
    const fakes = recorder()
    const ops = operations(fakes)

    await ops.archiveReview({ projectPath: PROJECT })
    await ops.restoreArchivedReview({ projectPath: PROJECT, id: 'old-1' })

    expect(fakes.archives.map((archive) => archive.id)).toEqual(['archive-1', 'archive-2'])
    expect(new Set(fakes.archives.map((archive) => archive.archivedAt)).size).toBe(1)
  })

  it('deletes an archive through the store', async () => {
    const fakes = recorder()

    await expect(
      operations(fakes).deleteArchivedReview({ projectPath: PROJECT, id: 'old-1' }),
    ).resolves.toEqual({ ok: true, value: undefined })
    expect(fakes.calls).toEqual(['remove:old-1'])
  })

  it('maps a rejected store or publication call to review.unavailable and runs no later effect', async () => {
    const staging = recorder({ rejectOn: 'recordPublished' })
    await expect(operations(staging).publishReview({ projectPath: PROJECT })).resolves.toEqual({
      ok: false,
      error: { code: 'review.unavailable' },
    })
    expect(staging.calls).toEqual(['activeCost', 'archiveActive', 'recordPublished'])

    const archiving = recorder({ rejectOn: 'archiveActive' })
    await expect(
      operations(archiving).restoreArchivedReview({ projectPath: PROJECT, id: 'old-1' }),
    ).resolves.toEqual({ ok: false, error: { code: 'review.unavailable' } })
    expect(archiving.calls).toEqual(['has:old-1', 'archiveActive'])

    const listing = recorder({ rejectOn: 'list' })
    await expect(operations(listing).archivedReviews({ projectPath: PROJECT })).resolves.toEqual({
      ok: false,
      error: { code: 'review.unavailable' },
    })
  })

  it('creates default archive ids that stay unique inside one millisecond', async () => {
    const fakes = recorder()
    const ops = createReviewLifecycleOperations({
      store: fakes.store,
      publication: fakes.publication,
    })

    await ops.archiveReview({ projectPath: PROJECT })
    await ops.archiveReview({ projectPath: PROJECT })

    const ids = fakes.archives.map((archive) => archive.id)
    expect(ids[0]).toMatch(/^[0-9a-z]+-[0-9a-f]{8}$/)
    expect(ids[1]).toMatch(/^[0-9a-z]+-[0-9a-f]{8}$/)
    expect(ids[0]).not.toBe(ids[1])
    for (const archive of fakes.archives) {
      expect(new Date(archive.archivedAt).toISOString()).toBe(archive.archivedAt)
    }
  })
})
