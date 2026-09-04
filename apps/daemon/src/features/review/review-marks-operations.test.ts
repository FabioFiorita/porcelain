import { describe, expect, it } from 'vitest'
import type { ReviewedMark, ReviewMarksGit, ReviewMarksStore } from './review-marks-capabilities'
import { createReviewMarksOperations } from './review-marks-operations'

const REPO = '/synthetic/repo'

function memoryStore(initial: ReviewedMark[] = []) {
  const marks = [...initial]
  const store: ReviewMarksStore = {
    read: async () => [...marks],
    write: async (_repo, next) => {
      marks.length = 0
      marks.push(
        ...[
          ...new Map(
            next.map((m) => [
              `${m.scope?.type ?? 'working'}\0${m.scope?.type === 'branch' ? m.scope.base : ''}\0${m.path}`,
              m,
            ]),
          ).values(),
        ],
      )
    },
    remove: async (_repo, stale) => {
      const keys = new Set(stale.map((m) => `${m.path}\0${m.fingerprint}`))
      const survivors = marks.filter((m) => !keys.has(`${m.path}\0${m.fingerprint}`))
      marks.length = 0
      marks.push(...survivors)
    },
  }
  return { store, marks }
}

function recordingGit(fingerprints: Record<string, string>) {
  const calls: string[][] = []
  const git: ReviewMarksGit = {
    fingerprints: async (_repo, paths) => {
      calls.push([...paths])
      // `path in fingerprints` does not narrow the index read, so filter+map produced a
      // Map<string, string | undefined>. flatMap drops the miss and keeps the value narrowed.
      return new Map(
        paths.flatMap((path) => {
          const fingerprint = fingerprints[path]
          return fingerprint === undefined ? [] : [[path, fingerprint] as const]
        }),
      )
    },
  }
  return { git, calls }
}

describe('review marks operations', () => {
  it('fingerprints each named path exactly once when marking', async () => {
    const { store } = memoryStore()
    const { git, calls } = recordingGit({ 'a.ts': 'fp-a', 'b.ts': 'fp-b' })
    const operations = createReviewMarksOperations({ store, git })

    await operations.setReviewed({ projectPath: REPO, paths: ['a.ts', 'b.ts'], reviewed: true })

    expect(calls).toEqual([['a.ts', 'b.ts']])
  })

  it('never fingerprints when unmarking', async () => {
    const { store } = memoryStore([{ path: 'a.ts', fingerprint: 'fp-a' }])
    const { git, calls } = recordingGit({})
    const operations = createReviewMarksOperations({ store, git })

    await operations.setReviewed({ projectPath: REPO, paths: ['a.ts'], reviewed: false })

    expect(calls).toEqual([])
  })

  it('keeps marks the caller did not name', async () => {
    const { store, marks } = memoryStore([{ path: 'kept.ts', fingerprint: 'fp-kept' }])
    const { git } = recordingGit({ 'a.ts': 'fp-a' })
    const operations = createReviewMarksOperations({ store, git })

    await operations.setReviewed({ projectPath: REPO, paths: ['a.ts'], reviewed: true })

    expect(marks).toEqual([
      { path: 'kept.ts', fingerprint: 'fp-kept' },
      { path: 'a.ts', fingerprint: 'fp-a' },
    ])
  })

  it('fingerprints only the marked paths when reading', async () => {
    const { store } = memoryStore([{ path: 'a.ts', fingerprint: 'fp-a' }])
    const { git, calls } = recordingGit({ 'a.ts': 'fp-a' })
    const operations = createReviewMarksOperations({ store, git })

    await expect(operations.readReviewedPaths({ projectPath: REPO })).resolves.toEqual(['a.ts'])
    expect(calls).toEqual([['a.ts']])
  })

  it('always prunes an empty-fingerprint mark', async () => {
    const { store, marks } = memoryStore([{ path: 'a.ts', fingerprint: '' }])
    const { git } = recordingGit({ 'a.ts': '' })
    const operations = createReviewMarksOperations({ store, git })

    await expect(operations.readReviewedPaths({ projectPath: REPO })).resolves.toEqual([])
    expect(marks).toEqual([])
  })

  it('surfaces a throwing fingerprint port instead of silently reporting no marks', async () => {
    const { store } = memoryStore([{ path: 'a.ts', fingerprint: 'fp-a' }])
    const operations = createReviewMarksOperations({
      store,
      git: {
        fingerprints: async () => {
          throw new Error('git exploded')
        },
      },
    })

    await expect(operations.readReviewedPaths({ projectPath: REPO })).rejects.toThrow(
      'git exploded',
    )
    await expect(
      operations.setReviewed({ projectPath: REPO, paths: ['a.ts'], reviewed: true }),
    ).rejects.toThrow('git exploded')
  })

  it('keeps reviewed marks isolated between branch comparison bases', async () => {
    const { store, marks } = memoryStore()
    const git: ReviewMarksGit = {
      fingerprints: async (_repo, paths, scope) =>
        new Map(
          paths.map((path) => [
            path,
            `${scope.type}:${scope.type === 'branch' ? scope.base : ''}:${path}`,
          ]),
        ),
    }
    const operations = createReviewMarksOperations({ store, git })

    await operations.setReviewed({
      projectPath: REPO,
      paths: ['a.ts'],
      reviewed: true,
      scope: { type: 'branch', base: 'main' },
    })
    await operations.setReviewed({
      projectPath: REPO,
      paths: ['a.ts'],
      reviewed: true,
      scope: { type: 'branch', base: 'develop' },
    })

    expect(marks).toHaveLength(2)
    await expect(
      operations.readReviewedPaths({ projectPath: REPO, scope: { type: 'branch', base: 'main' } }),
    ).resolves.toEqual(['a.ts'])
    await expect(
      operations.readReviewedPaths({ projectPath: REPO, scope: { type: 'working' } }),
    ).resolves.toEqual([])
  })

  it('does not leak another scope after pruning a stale mark', async () => {
    const { store } = memoryStore([
      { path: 'stale.ts', fingerprint: 'old', scope: { type: 'branch', base: 'main' } },
      { path: 'other.ts', fingerprint: 'kept', scope: { type: 'branch', base: 'develop' } },
    ])
    const { git } = recordingGit({ 'stale.ts': 'new' })
    const operations = createReviewMarksOperations({ store, git })

    await expect(
      operations.readReviewedPaths({ projectPath: REPO, scope: { type: 'branch', base: 'main' } }),
    ).resolves.toEqual([])
  })
})
