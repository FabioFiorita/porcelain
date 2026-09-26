import type { Probe } from '../probe.ts';

export default {
  decision: 'X6',
  plants:
    'reviews in-memory-comment-seen-store.ts save() with this.#count++ counting calls',
  gate: 'lint',
  rule: 'porcelain(fakes-store)',
  edits: [
    {
      kind: 'replace',
      path: 'packages/reviews/spec/fakes/in-memory-comment-seen-store.ts',
      old: `  private readonly seen = new Map<string, number>();`,
      new: `  private readonly seen = new Map<string, number>();
  #count = 0;
  readonly #calls = new Map<string, number>();

  calls(): number {
    return this.#count + this.#calls.size;
  }`,
    },
    {
      kind: 'replace',
      path: 'packages/reviews/spec/fakes/in-memory-comment-seen-store.ts',
      old: `    this.seen.set(input.worktreeId, input.seenThrough);`,
      new: `    this.#count++;
    this.seen.set(input.worktreeId, input.seenThrough);`,
    },
  ],
} satisfies Probe;
