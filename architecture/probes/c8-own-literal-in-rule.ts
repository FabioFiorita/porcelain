import type { Probe } from '../probe.ts';

export default {
  decision: 'C8',
  plants:
    'reviews/rules/comment-threads.ts: const MAX_THREADS = 100 (unexported) used by a new rule',
  gate: 'lint',
  rule: 'porcelain(no-number-outside-limits)',
  edits: [
    {
      kind: 'append',
      path: 'packages/reviews/src/rules/comment-threads.ts',
      content: `
const MAX_THREADS = 100;

export function threadCapacityLeft(threads: number): number {
  return Math.max(0, MAX_THREADS - threads);
}
`,
    },
  ],
} satisfies Probe;
