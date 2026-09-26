import type { Probe } from '../probe.ts';

export default {
  decision: 'C9',
  plants:
    'reviews/spec/fakes/in-memory-comment-seen-store.ts: class renamed MemoryCommentSeenStore (spec updated)',
  gate: 'lint',
  rule: 'porcelain(naming)',
  edits: [
    {
      kind: 'replace',
      path: 'packages/reviews/spec/fakes/in-memory-comment-seen-store.ts',
      old: 'InMemoryCommentSeenStore',
      new: 'MemoryCommentSeenStore',
    },
    {
      kind: 'replace',
      path: 'packages/reviews/src/services/mark-comments-seen-service.spec.ts',
      old: 'InMemoryCommentSeenStore',
      new: 'MemoryCommentSeenStore',
      all: true,
    },
  ],
} satisfies Probe;
