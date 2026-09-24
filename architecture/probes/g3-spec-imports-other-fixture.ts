import type { Probe } from '../probe.ts';

export default {
  decision: 'G3',
  plants:
    'reviews mark-comments-seen-service.spec.ts imports fixture() from ../../../git/spec/fixtures/fixture.ts',
  gate: 'arch',
  rule: 'cross-package-import-must-use-package-name:',
  edits: [
    {
      kind: 'replace',
      path: 'packages/reviews/src/services/mark-comments-seen-service.spec.ts',
      old: "import { describe, expect, it } from 'vitest';",
      new: `import { describe, expect, it } from 'vitest';
import { fixture } from '../../../git/spec/fixtures/fixture.ts';`,
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

  it('reads captured text as bytes', () => {
    expect(fixture('diff/latin1.txt').length).toBeGreaterThan(0);
  });
});
`,
    },
  ],
} satisfies Probe;
