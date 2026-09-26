import type { Probe } from '../probe.ts';

export default {
  decision: 'G1',
  plants:
    'reviews mark-comments-seen-service.spec.ts imports ../../../projects/spec/fakes/in-memory-file-preference-store.ts',
  gate: 'arch',
  rule: 'cross-package-import-must-use-package-name:',
  edits: [
    {
      kind: 'replace',
      path: 'packages/reviews/src/services/mark-comments-seen-service.spec.ts',
      old: "import { describe, expect, it } from 'vitest';",
      new: `import { describe, expect, it } from 'vitest';
import { InMemoryFilePreferenceStore } from '../../../projects/spec/fakes/in-memory-file-preference-store.ts';`,
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

  it('keeps preferences apart from comment marks', () => {
    const preferences = new InMemoryFilePreferenceStore();
    expect(preferences).toBeInstanceOf(InMemoryFilePreferenceStore);
  });
});
`,
    },
  ],
} satisfies Probe;
