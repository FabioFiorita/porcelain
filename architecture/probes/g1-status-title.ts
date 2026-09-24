import type { Probe } from '../probe.ts';

export default {
  decision: 'G1',
  plants:
    "reviews mark-comments-seen-service.spec.ts: it('returns 404 for an unknown worktree', ...)",
  gate: 'lint',
  rule: 'porcelain(spec-behaviour-names)',
  edits: [
    {
      kind: 'replace',
      path: 'packages/reviews/src/services/mark-comments-seen-service.spec.ts',
      old: `    expect(seen.seenThrough({ worktreeId })).toBe(2);
  });
});
`,
      new: `    expect(seen.seenThrough({ worktreeId })).toBe(2);
  });

  it('returns 404 for an unknown worktree', () => {
    const { service } = setup();
    expect(service.execute({ worktreeId: 'c'.repeat(64), throughRevision: 1 }).seenThrough).toBe(0);
  });
});
`,
    },
  ],
} satisfies Probe;
