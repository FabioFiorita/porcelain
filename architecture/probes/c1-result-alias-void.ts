import type { Probe } from '../probe.ts';

export default {
  decision: 'C1',
  plants:
    'reviews/models/record-review-activity.ts: export type RecordReviewActivityResult = void;',
  gate: 'lint',
  rule: 'porcelain(models-file-shape)',
  edits: [
    {
      kind: 'replace',
      path: 'packages/reviews/src/models/record-review-activity.ts',
      old: 'export type RecordReviewActivityResult = { changed: boolean };',
      new: 'export type RecordReviewActivityResult = void;',
    },
  ],
} satisfies Probe;
