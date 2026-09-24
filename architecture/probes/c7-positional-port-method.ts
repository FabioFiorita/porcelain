import type { Probe } from '../probe.ts';

export default {
  decision: 'C7',
  plants:
    'reviews/ports/review-store.ts: setActive(worktreeId: string, revision: number, active: boolean)',
  gate: 'lint',
  rule: 'porcelain(port-shape)',
  edits: [
    {
      kind: 'replace',
      path: 'packages/reviews/src/ports/review-store.ts',
      old: '  setActive(input: ReviewActivity): void;',
      new: '  setActive(worktreeId: string, revision: number, active: boolean): void;',
    },
  ],
} satisfies Probe;
