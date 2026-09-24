import type { Probe } from '../probe.ts';

export default {
  decision: 'C8',
  plants:
    'reviews/rules/comment-threads.ts: export const THREADS_PER_WORKTREE = 100;',
  gate: 'lint',
  rule: 'porcelain(no-exported-constants)',
  edits: [
    {
      kind: 'append',
      path: 'packages/reviews/src/rules/comment-threads.ts',
      content: `
export const THREADS_PER_WORKTREE = 100;
`,
    },
  ],
} satisfies Probe;
