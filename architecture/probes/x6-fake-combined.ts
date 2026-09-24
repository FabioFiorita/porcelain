import type { Probe } from '../probe.ts';

export default {
  decision: 'X6',
  plants:
    'the audit fake: &&, ??, filter().forEach, #count++ and a #calls Map log in one save()',
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
    this.#calls.set(\`save:\${this.#count}\`, input.seenThrough);
    const stored = this.seen.get(input.worktreeId);
    stored === undefined && this.seen.set(input.worktreeId, input.seenThrough);
    stored ?? this.seen.set(input.worktreeId, input.seenThrough);
    [stored ?? 0]
      .filter((known) => known < input.seenThrough)
      .forEach(() => this.seen.set(input.worktreeId, input.seenThrough));`,
    },
  ],
} satisfies Probe;
