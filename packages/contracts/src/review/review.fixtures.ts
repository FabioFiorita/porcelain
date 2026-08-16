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
/**
 * Fixtures used as procedure INPUTS as well as outputs. `as const` froze every array to a
 * readonly tuple, so a test handing one to the procedure it describes was a type error — the
 * fixture could not be used for the thing it exists for. Left inferred and mutable.
 */
export const reviewContractFixtures = {
  reviewedPaths: { input: '/synthetic/repo', output: ['src/changed.ts'] },
  setReviewed: {
    input: {
      repoPath: '/synthetic/repo',
      paths: ['src/changed.ts', 'src/context.ts'],
      reviewed: true,
    },
    output: undefined,
  },
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
}
