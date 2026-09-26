import type { Probe } from '../probe.ts';

export default {
  decision: 'X6',
  plants:
    'reviews in-memory-comment-seen-store.ts save() writes through a nested field, this.counter.calls = ..., keeping a call record',
  gate: 'lint',
  rule: 'porcelain(fakes-store)',
  edits: [
    {
      kind: 'replace',
      path: 'packages/reviews/spec/fakes/in-memory-comment-seen-store.ts',
      old: `  private readonly seen = new Map<string, number>();`,
      new: `  private readonly seen = new Map<string, number>();
  private readonly counter = { calls: 0 };`,
    },
    {
      kind: 'replace',
      path: 'packages/reviews/spec/fakes/in-memory-comment-seen-store.ts',
      old: `    this.seen.set(input.worktreeId, input.seenThrough);`,
      new: `    this.counter.calls = input.seenThrough;
    this.seen.set(input.worktreeId, input.seenThrough);`,
    },
  ],
} satisfies Probe;
