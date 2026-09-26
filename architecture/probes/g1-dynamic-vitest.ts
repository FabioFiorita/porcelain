import type { Probe } from '../probe.ts';

export default {
  decision: 'G1',
  plants:
    "reviews mark-comments-seen-service.spec.ts: const { vi } = await import('vitest') in a case",
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

  it('reads the clock once per mark', async () => {
    const { vi } = await import('vitest');
    const spy = vi.fn();
    spy();
    expect(spy.mock.calls.length).toBe(1);
  });
});
`,
    },
  ],
} satisfies Probe;
