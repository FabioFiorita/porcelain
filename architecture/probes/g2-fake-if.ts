import type { Probe } from '../probe.ts';

export default {
  decision: 'G2',
  plants:
    'reviews/spec/fakes/in-memory-comment-seen-store.ts: save() ignores a lower mark with an if (a rule in the fake)',
  gate: 'lint',
  rule: 'porcelain(fakes-store)',
  edits: [
    {
      kind: 'replace',
      path: 'packages/reviews/spec/fakes/in-memory-comment-seen-store.ts',
      old: '    this.seen.set(input.worktreeId, input.seenThrough);',
      new: `    if ((this.seen.get(input.worktreeId) ?? 0) > input.seenThrough) return;
    this.seen.set(input.worktreeId, input.seenThrough);`,
    },
  ],
} satisfies Probe;
