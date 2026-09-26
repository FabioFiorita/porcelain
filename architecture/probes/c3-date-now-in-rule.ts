import type { Probe } from '../probe.ts';

export default {
  decision: 'C3',
  plants: 'reviews/rules/review-digests.ts: summaryAge() using Date.now()',
  gate: 'lint',
  rule: 'porcelain(rules-are-pure)',
  edits: [
    {
      kind: 'append',
      path: 'packages/reviews/src/rules/review-digests.ts',
      content: `
export function summaryAgeMs(createdAt: string): number {
  return Date.now() - Date.parse(createdAt);
}
`,
    },
  ],
} satisfies Probe;
