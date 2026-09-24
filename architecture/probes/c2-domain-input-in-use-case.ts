import type { Probe } from '../probe.ts';

export default {
  decision: 'C2',
  plants:
    'use-cases/reviews/create-comment-thread.ts takes the reviews domain model as its input instead of the contract types its route validated',
  gate: 'lint',
  rule: 'porcelain(use-case-input-is-contract)',
  edits: [
    {
      kind: 'prepend',
      path: 'apps/server/src/use-cases/reviews/create-comment-thread.ts',
      content: `import type { CreateCommentThreadInput } from '@porcelain/reviews/models';
`,
    },
    {
      kind: 'replace',
      path: 'apps/server/src/use-cases/reviews/create-comment-thread.ts',
      old: '    input: WorktreeParams & CreateCommentThreadRequest & CommentAuthor,',
      new: '    input: CreateCommentThreadInput,',
    },
  ],
} satisfies Probe;
