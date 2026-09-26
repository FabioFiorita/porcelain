import type { Probe } from '../probe.ts';

export default {
  decision: 'N1',
  plants:
    'storage sqlite-comment-seen-store.ts: SqliteCommentSeenStore implements CommentSeenStore, CommentStore',
  gate: 'lint',
  rule: 'porcelain(implementation-name)',
  edits: [
    {
      kind: 'replace',
      path: 'packages/storage/src/repositories/reviews/sqlite-comment-seen-store.ts',
      old: "import type { CommentSeenStore } from '@porcelain/reviews/ports';",
      new: "import type { CommentSeenStore, CommentStore } from '@porcelain/reviews/ports';",
    },
    {
      kind: 'replace',
      path: 'packages/storage/src/repositories/reviews/sqlite-comment-seen-store.ts',
      old: 'implements CommentSeenStore {',
      new: 'implements CommentSeenStore, CommentStore {',
    },
  ],
} satisfies Probe;
