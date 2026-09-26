import type { Probe } from '../probe.ts';

export default {
  decision: 'X5',
  plants:
    "use-cases/reviews/update-comment-thread.ts lane changed to 'read' (the service writes only through comments.resolve)",
  gate: 'arch',
  rule: 'lane-mode-matches-service:',
  edits: [
    {
      kind: 'replace',
      path: 'apps/server/src/use-cases/reviews/update-comment-thread.ts',
      old: `      'write',`,
      new: `      'read',`,
    },
  ],
} satisfies Probe;
