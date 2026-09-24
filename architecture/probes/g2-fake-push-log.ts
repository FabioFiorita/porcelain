import type { Probe } from '../probe.ts';

export default {
  decision: 'G2',
  plants:
    'reviews/spec/fakes/in-memory-comment-seen-store.ts: readonly saves = [] and this.saves.push(input) in save()',
  gate: 'lint',
  rule: 'porcelain(fakes-store)',
  edits: [
    {
      kind: 'replace',
      path: 'packages/reviews/spec/fakes/in-memory-comment-seen-store.ts',
      old: '  private readonly seen = new Map<string, number>();',
      new: `  private readonly seen = new Map<string, number>();
  readonly saves: { worktreeId: string; seenThrough: number }[] = [];`,
    },
    {
      kind: 'replace',
      path: 'packages/reviews/spec/fakes/in-memory-comment-seen-store.ts',
      old: '    this.seen.set(input.worktreeId, input.seenThrough);',
      new: `    this.saves.push(input);
    this.seen.set(input.worktreeId, input.seenThrough);`,
    },
  ],
} satisfies Probe;
