import type { Probe } from '../probe.ts';

export default {
  decision: 'R3',
  plants:
    "reviews/rules/comment-threads.ts: const MAX_THREADS = Number('100') (a limit hidden in a string) used by a new rule",
  gate: 'lint',
  rule: 'porcelain(no-number-outside-limits)',
  edits: [
    {
      kind: 'append',
      path: 'packages/reviews/src/rules/comment-threads.ts',
      content: `
const MAX_THREADS = Number('100');

export function threadCapacityLeft(threads: number): number {
  return Math.max(0, MAX_THREADS - threads);
}
`,
    },
  ],
} satisfies Probe;
