// @vitest-environment node
import { describe, expect, it } from 'vitest'
import type { DiffHunk } from '../../git/diff'
import type { FeatureReading, FeatureView } from '../../review/feature-view'
import type { ReviewSet } from '../../review/review-set'
import { createExploreReview } from './explore-review'
import { createReadActiveReview } from './read-active-review'
import { createReadReviewReading } from './read-review-reading'
import type {
  ReviewBuiltReview,
  ReviewEvidence,
  ReviewEvidenceSummary,
  ReviewFiles,
  ReviewGatherState,
  ReviewGit,
  ReviewReadingSources,
} from './review-reading-capabilities'

/**
 * In-memory capability fakes: they answer from the case's own synthetic data and
 * record call order, never reimplementing git, the build memo, or the filesystem.
 * The pure builders (`buildFeatureReading`, `walkExplore`, `buildExploreReading`)
 * run for real — they are the shared production modules these operations compose,
 * and they keep their own tests under `review/`.
 */

const REPO = '/synthetic/repo'

const REVIEW_SET: ReviewSet = {
  name: 'Review',
  files: [{ path: 'src/alpha.ts', source: 'changed' }],
  sections: [],
  canvas: { medium: 'html', html: '<p>overview</p>' },
}

const SUMMARY: ReviewEvidenceSummary = {
  title: 'Evidence',
  updatedAt: '2026-08-11T00:00:00.000Z',
  checks: [{ label: 'pnpm lint', status: 'pass' }],
  medium: 'html',
}

const VIEW: FeatureView = {
  name: 'Review',
  fromAgent: true,
  sections: [],
  groups: [
    {
      layer: 'source',
      files: [
        { path: 'src/alpha.ts', source: 'changed', connects: [] },
        { path: 'src/beta.ts', source: 'changed', connects: [] },
        { path: 'src/shipped.ts', source: 'shipped', connects: [] },
      ],
    },
  ],
}

function hunk(text: string): DiffHunk {
  return { header: '@@ -1 +1 @@', lines: [{ kind: 'add', oldLine: null, newLine: 1, text }] }
}

function gathered(reviewSet: ReviewSet | null): ReviewGatherState {
  return { files: [], stats: [], layers: [], reviewSet, key: 'key-1' }
}

type SourceFakeConfig = {
  gather?: ReviewGatherState
  built?: ReviewBuiltReview
  cached?: FeatureReading | null
}

function sourcesFake(config: SourceFakeConfig, calls: string[]) {
  const stored: { key: string; reading: FeatureReading }[] = []
  const sources = {
    gather: async () => {
      calls.push('gather')
      return config.gather ?? gathered(REVIEW_SET)
    },
    build: async () => {
      calls.push('build')
      return config.built ?? { key: 'key-1', view: VIEW, sources: new Map() }
    },
    cachedReading: () => {
      calls.push('cachedReading')
      return config.cached ?? null
    },
    storeReading: (_repoPath: string, key: string, reading: FeatureReading) => {
      calls.push('storeReading')
      stored.push({ key, reading })
    },
    hasReviewSet: async () => false,
  } satisfies ReviewReadingSources
  return { sources, stored }
}

function evidenceFake(calls: string[], summary: ReviewEvidenceSummary | null = SUMMARY) {
  return {
    readSummary: async () => {
      calls.push('readSummary')
      return summary
    },
  } satisfies ReviewEvidence
}

function gitFake(
  hunksByPath: Record<string, DiffHunk[] | 'reject'>,
  calls: string[],
  files: string[] = [],
) {
  return {
    fileHunks: async (_repoPath: string, path: string) => {
      calls.push(`fileHunks:${path}`)
      const answer = hunksByPath[path]
      if (answer === 'reject' || answer === undefined) throw new Error('file vanished')
      return answer
    },
    listFiles: async () => files,
    worktrees: async () => [],
    changedCount: async () => 0,
  } satisfies ReviewGit
}

function filesFake(bodies: Record<string, string>, calls: string[]) {
  return {
    readSource: async (_repoPath: string, path: string) => {
      calls.push(`readSource:${path}`)
      return bodies[path]
    },
  } satisfies ReviewFiles
}

describe('readActiveReview', () => {
  it('returns null without a review set and never builds', async () => {
    const calls: string[] = []
    const { sources } = sourcesFake({ gather: gathered(null) }, calls)

    await expect(createReadActiveReview({ sources })({ projectPath: REPO })).resolves.toBeNull()
    expect(calls).toEqual(['gather'])
  })

  it('returns the built view when the agent declared a review set', async () => {
    const calls: string[] = []
    const { sources } = sourcesFake({}, calls)

    await expect(createReadActiveReview({ sources })({ projectPath: REPO })).resolves.toBe(VIEW)
    expect(calls).toEqual(['gather', 'build'])
  })
})

describe('readReviewReading', () => {
  it('returns null without a review set and never reads Evidence', async () => {
    const calls: string[] = []
    const { sources } = sourcesFake({ gather: gathered(null) }, calls)

    const reading = await createReadReviewReading({
      sources,
      git: gitFake({}, calls),
      evidence: evidenceFake(calls),
    })({ projectPath: REPO })

    expect(reading).toBeNull()
    expect(calls).toEqual(['gather'])
  })

  it('reattaches the fresh Evidence summary and the canvas to a cached reading', async () => {
    const calls: string[] = []
    const cached: FeatureReading = {
      name: 'Review',
      sections: [],
      groups: [],
      evidence: null,
    }
    const { sources } = sourcesFake({ cached }, calls)

    const reading = await createReadReviewReading({
      sources,
      git: gitFake({}, calls),
      evidence: evidenceFake(calls),
    })({ projectPath: REPO })

    expect(reading).toEqual({ ...cached, evidence: SUMMARY, canvas: REVIEW_SET.canvas })
    expect(calls).toEqual(['gather', 'readSummary', 'cachedReading'])
  })

  it('builds, diffs only changed files, stores under the gather key, and carries summary and canvas', async () => {
    const calls: string[] = []
    const { sources, stored } = sourcesFake({}, calls)

    const reading = await createReadReviewReading({
      sources,
      git: gitFake({ 'src/alpha.ts': [hunk('alpha')], 'src/beta.ts': [hunk('beta')] }, calls),
      evidence: evidenceFake(calls),
    })({ projectPath: REPO })

    expect(calls.filter((call) => call.startsWith('fileHunks:')).sort()).toEqual([
      'fileHunks:src/alpha.ts',
      'fileHunks:src/beta.ts',
    ])
    expect(reading?.evidence).toEqual(SUMMARY)
    expect(reading?.canvas).toEqual(REVIEW_SET.canvas)
    expect(stored).toEqual([{ key: 'key-1', reading }])
  })

  it('leaves a vanished file without hunks and keeps the other files intact', async () => {
    const calls: string[] = []
    const { sources } = sourcesFake({}, calls)

    const reading = await createReadReviewReading({
      sources,
      git: gitFake({ 'src/alpha.ts': [hunk('alpha')], 'src/beta.ts': 'reject' }, calls),
      evidence: evidenceFake(calls),
    })({ projectPath: REPO })

    const files = reading?.groups.flatMap((group) => group.files) ?? []
    expect(files.find((file) => file.path === 'src/alpha.ts')?.hunks).toEqual([hunk('alpha')])
    expect(files.find((file) => file.path === 'src/beta.ts')?.hunks).toEqual([])
  })

  it('emits a null Evidence chapter when the project published no pack', async () => {
    const calls: string[] = []
    const { sources } = sourcesFake({}, calls)

    const reading = await createReadReviewReading({
      sources,
      git: gitFake({ 'src/alpha.ts': [], 'src/beta.ts': [] }, calls),
      evidence: evidenceFake(calls, null),
    })({ projectPath: REPO })

    expect(reading?.evidence).toBeNull()
  })
})

describe('exploreReview', () => {
  it('names the reading from a symbol seed and reads each source at most once', async () => {
    const calls: string[] = []
    const git = gitFake({}, calls, ['src/alpha.ts', 'src/beta.ts'])
    const files = filesFake(
      {
        'src/alpha.ts':
          "import { beta } from './beta'\nexport function alpha() {\n  return beta\n}\n",
        'src/beta.ts': 'export const beta = 1\n',
      },
      calls,
    )

    const reading = await createExploreReview({ git, files })({
      projectPath: REPO,
      seed: { kind: 'symbol', path: 'src/alpha.ts', symbol: 'alpha' },
    })

    expect(reading.name).toBe('alpha')
    const reads = calls.filter((call) => call.startsWith('readSource:'))
    expect(new Set(reads).size).toBe(reads.length)
  })

  it('names the reading from a file seed, treats an unreadable source as a leaf, and falls back to the default layers', async () => {
    const calls: string[] = []
    const git = gitFake({}, calls, ['src/gone.ts'])
    const files = filesFake({}, calls)

    const reading = await createExploreReview({ git, files })({
      projectPath: REPO,
      seed: { kind: 'file', path: 'src/gone.ts' },
    })

    expect(reading.name).toBe('gone.ts')
    expect(reading.evidence).toBeNull()
    // No project layers under the synthetic path, so the walk groups under the
    // DEFAULT_LAYERS starters rather than failing.
    expect(reading.groups.length).toBeGreaterThan(0)
  })
})
