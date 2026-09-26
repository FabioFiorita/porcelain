import type { Probe } from '../probe.ts';

export default {
  decision: 'S3',
  plants:
    "use-cases/reviews/create-comment-thread.ts lane 'write' changed to 'read' (the write is createCommentThread, a verb outside set/record/reconcile/update/remove/collect)",
  gate: 'arch',
  rule: 'lane-mode-matches-service:',
  edits: [
    {
      kind: 'replace',
      path: 'apps/server/src/use-cases/reviews/create-comment-thread.ts',
      old: "      'write',",
      new: "      'read',",
    },
  ],
} satisfies Probe;
