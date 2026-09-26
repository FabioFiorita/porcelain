import type { Probe } from '../probe.ts';

export default {
  decision: 'G1',
  plants:
    'reviews mark-comments-seen-service.spec.ts: expect(fn).toHaveBeenNthCalledWith(1, ...)',
  gate: 'lint',
  rule: 'porcelain(spec-no-mocking)',
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

  it('saves the mark it answers', () => {
    const { service, seen } = setup();
    const saved = seen.save.bind(seen);
    service.execute({ worktreeId, throughRevision: 1 });
    expect(saved).toHaveBeenNthCalledWith(1, { worktreeId, seenThrough: 1 });
  });
});
`,
    },
  ],
} satisfies Probe;
