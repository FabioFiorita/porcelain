import type { Probe } from '../probe.ts';

export default {
  decision: 'G2',
  plants:
    'fake records calls by spread (`this.saves = [...this.saves, input]`) and the spec asserts expect(seen.saves).toEqual([...])',
  gate: 'lint',
  rule: 'porcelain(fakes-store)',
  edits: [
    {
      kind: 'replace',
      path: 'packages/reviews/spec/fakes/in-memory-comment-seen-store.ts',
      old: '  private readonly seen = new Map<string, number>();',
      new: `  private readonly seen = new Map<string, number>();
  saves: { worktreeId: string; seenThrough: number }[] = [];`,
    },
    {
      kind: 'replace',
      path: 'packages/reviews/spec/fakes/in-memory-comment-seen-store.ts',
      old: '    this.seen.set(input.worktreeId, input.seenThrough);',
      new: `    this.saves = [...this.saves, input];
    this.seen.set(input.worktreeId, input.seenThrough);`,
    },
    {
      kind: 'replace',
      path: 'packages/reviews/src/services/mark-comments-seen-service.spec.ts',
      old: `    expect(seen.seenThrough({ worktreeId })).toBe(2);
  });
});
`,
      new: `    expect(seen.seenThrough({ worktreeId })).toBe(2);
  });

  it('saves the mark once per call', () => {
    const { service, seen } = setup();
    service.execute({ worktreeId, throughRevision: 1 });
    expect(seen.saves).toEqual([{ worktreeId, seenThrough: 1 }]);
  });
});
`,
    },
  ],
} satisfies Probe;
