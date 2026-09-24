import type { Probe } from '../probe.ts';

export default {
  decision: 'G2',
  plants:
    'reviews/spec/fakes/in-memory-comment-seen-store.ts: save() keeps the higher mark with a ternary (a rule, no if)',
  gate: 'lint',
  rule: 'porcelain(fakes-store)',
  edits: [
    {
      kind: 'replace',
      path: 'packages/reviews/spec/fakes/in-memory-comment-seen-store.ts',
      old: '    this.seen.set(input.worktreeId, input.seenThrough);',
      new: `    const current = this.seen.get(input.worktreeId) ?? 0;
    this.seen.set(
      input.worktreeId,
      current > input.seenThrough ? current : input.seenThrough,
    );`,
    },
  ],
} satisfies Probe;
