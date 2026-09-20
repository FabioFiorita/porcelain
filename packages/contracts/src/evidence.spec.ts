import { expect, it } from 'vitest';
import { evidenceResponseSchema } from './evidence.ts';

it('accepts grouped evidence with null fingerprints for unsafe comparisons', () => {
  const response = evidenceResponseSchema.parse({
    environmentId: 'fac0e50f-b019-4e46-9dd1-efcb6af7dc09',
    worktreeId: '801a86281cd6456281a29c05fba76b4a',
    statusToken: 'a'.repeat(64),
    consistency: 'best-effort',
    evidence: [
      {
        path: 'src/file.ts',
        fingerprint: null,
        comparisons: [
          {
            change: {
              scope: 'unmerged',
              path: 'src/file.ts',
              conflict: 'UU',
            },
            content: { kind: 'omitted', reason: 'conflict' },
          },
        ],
      },
    ],
  });
  expect(response.evidence[0]?.fingerprint).toBeNull();
});
