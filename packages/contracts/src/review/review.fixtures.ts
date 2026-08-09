const diffHunk = {
  header: '@@ -1,1 +1,1 @@',
  lines: [{ kind: 'add', oldLine: null, newLine: 1, text: 'synthetic review change' }],
} as const

const evidenceChecks = [
  { label: 'Unit tests', status: 'pass', detail: 'Synthetic checks passed.' },
  { label: 'Browser proof', status: 'skip' },
] as const

const featureView = {
  name: 'Synthetic Review',
  fromAgent: true,
  thesis: 'A synthetic review thesis.',
  sections: [{ title: 'Execution', anchorCount: 1 }],
  groups: [
    {
      layer: 'Source',
      files: [
        {
          path: 'src/changed.ts',
          source: 'changed',
          status: 'modified',
          note: 'Synthetic note',
          layer: 'Source',
          additions: 2,
          deletions: 1,
          connects: ['src/context.ts'],
        },
      ],
    },
  ],
} as const

const featureReading = {
  name: 'Synthetic Review',
  thesis: 'A synthetic reading thesis.',
  sections: [
    {
      title: 'Execution',
      prose: 'Synthetic prose.',
      diagram: '<svg></svg>',
      html: '<p>Synthetic HTML.</p>',
      htmlHeight: 448,
      files: [
        {
          path: 'src/changed.ts',
          source: 'changed',
          status: 'modified',
          note: 'Synthetic note',
          additions: 2,
          deletions: 1,
          hunks: [diffHunk],
        },
      ],
    },
  ],
  groups: [
    {
      layer: 'Source',
      files: [
        {
          path: 'src/context.ts',
          source: 'context',
          note: 'Synthetic context',
          ranges: [{ startLine: 1, lines: ['export const value = 1'], gapBefore: 0 }],
          truncated: false,
          whole: false,
        },
      ],
    },
  ],
  canvas: { medium: 'html', html: '<main>Synthetic canvas.</main>' },
  evidence: {
    title: 'Synthetic evidence',
    updatedAt: '2026-08-09T12:00:00.000Z',
    checks: evidenceChecks,
    medium: 'html',
  },
} as const

const reviewDocs = [
  { file: 'overview.md', label: 'Overview', medium: 'markdown', body: '# Synthetic intent' },
  { file: 'report.html', label: 'Report', medium: 'html', body: '<p>Synthetic result.</p>' },
] as const

const evidenceMeta = {
  title: 'Synthetic evidence',
  updatedAt: '2026-08-09T12:00:00.000Z',
  checks: evidenceChecks,
  dir: '/synthetic/repo/.porcelain/active-review/evidence',
  medium: 'html',
  results: 1,
  assets: 1,
  hasReport: false,
} as const

const evidence = {
  title: 'Synthetic evidence',
  updatedAt: '2026-08-09T12:00:00.000Z',
  dir: '/synthetic/repo/.porcelain/active-review/evidence',
  checks: evidenceChecks,
  medium: 'html',
  html: '<!doctype html><p>Synthetic evidence.</p>',
} as const

const reviewComment = {
  id: 'comment-synthetic',
  path: 'src/changed.ts',
  startLine: 1,
  endLine: 2,
  anchorText: 'synthetic review change',
  body: 'Synthetic comment.',
  resolved: false,
  createdAt: 1_754_737_600_000,
  agentReply: { body: 'Synthetic reply.', createdAt: 1_754_737_601_000 },
} as const

/** Representative Review wire values used by boundary tests and client mocks. */
export const reviewContractFixtures = {
  worktreeInbox: {
    input: '/synthetic/repo',
    output: [
      {
        path: '/synthetic/repo-worktrees/topic',
        branch: 'topic/synthetic',
        changedCount: 2,
        hasReview: true,
      },
    ],
  },
  markReviewed: {
    input: { repoPath: '/synthetic/repo', path: 'src/changed.ts' },
    output: undefined,
  },
  unmarkReviewed: {
    input: { repoPath: '/synthetic/repo', path: 'src/changed.ts' },
    output: undefined,
  },
  reviewedPaths: { input: '/synthetic/repo', output: ['src/changed.ts'] },
  setReviewed: {
    input: { repoPath: '/synthetic/repo', paths: ['src/changed.ts', 'src/context.ts'] },
    output: undefined,
  },
  featureView: { input: '/synthetic/repo', output: featureView },
  featureReading: { input: '/synthetic/repo', output: featureReading },
  clearFeatureReview: { input: '/synthetic/repo', output: undefined },
  reviewIntent: { input: '/synthetic/repo', output: reviewDocs },
  reviewEvidenceDocs: { input: '/synthetic/repo', output: [reviewDocs[1]] },
  reviewEvidenceAssets: {
    input: '/synthetic/repo',
    output: [
      {
        file: 'shot.png',
        label: 'Shot',
        kind: 'image',
        mime: 'image/png',
        bytes: 128,
      },
    ],
  },
  reviewEvidenceAsset: {
    input: { repoPath: '/synthetic/repo', file: 'shot.png' },
    output: {
      file: 'shot.png',
      mime: 'image/png',
      bytes: 4,
      dataUrl: 'data:image/png;base64,AA==',
    },
  },
  reviewPublishCost: { input: '/synthetic/repo', output: { bytes: 2048, files: 4 } },
  publishReview: {
    input: '/synthetic/repo',
    output: { id: 'archive-synthetic', cost: { bytes: 2048, files: 4 } },
  },
  archivedReviews: {
    input: '/synthetic/repo',
    output: [
      {
        id: 'archive-synthetic',
        name: 'Synthetic Review',
        thesis: 'A synthetic archived thesis.',
        archivedAt: '2026-08-09T12:00:00.000Z',
      },
    ],
  },
  restoreArchivedReview: {
    input: { repoPath: '/synthetic/repo', id: 'archive-synthetic' },
    output: undefined,
  },
  deleteArchivedReview: {
    input: { repoPath: '/synthetic/repo', id: 'archive-synthetic' },
    output: undefined,
  },
  loopEvidence: { input: '/synthetic/repo', output: evidenceMeta },
  loopEvidenceHtml: { input: '/synthetic/repo', output: evidence },
  clearLoopEvidence: { input: '/synthetic/repo', output: undefined },
  reviewComments: { input: '/synthetic/repo', output: [reviewComment] },
  addReviewComment: {
    input: {
      repoPath: '/synthetic/repo',
      path: 'src/changed.ts',
      startLine: 1,
      endLine: 2,
      anchorText: 'synthetic review change',
      body: 'Synthetic comment.',
    },
    output: reviewComment,
  },
  editReviewComment: {
    input: {
      repoPath: '/synthetic/repo',
      id: 'comment-synthetic',
      body: 'Edited synthetic comment.',
    },
    output: undefined,
  },
  deleteReviewComment: {
    input: { repoPath: '/synthetic/repo', id: 'comment-synthetic' },
    output: undefined,
  },
  clearResolvedReviewComments: {
    input: { repoPath: '/synthetic/repo' },
    output: undefined,
  },
  resolveReviewComment: {
    input: { repoPath: '/synthetic/repo', id: 'comment-synthetic', resolved: true },
    output: undefined,
  },
  exploreFeature: {
    input: {
      repoPath: '/synthetic/repo',
      seed: { kind: 'symbol', path: 'src/changed.ts', symbol: 'value' },
    },
    output: featureReading,
  },
  repoLayers: {
    input: '/synthetic/repo',
    output: {
      layers: [{ label: 'Docs', pattern: '(^|/)docs/' }],
      custom: true,
    },
  },
  setRepoLayers: {
    input: {
      repoPath: '/synthetic/repo',
      layers: [{ label: ' Docs ', pattern: '(^|/)docs/' }],
    },
    output: undefined,
  },
} as const
