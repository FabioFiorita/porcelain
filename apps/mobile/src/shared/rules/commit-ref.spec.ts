import { expect, test } from 'vitest';
import { commitRefLabel } from './commit-ref';

test('same-named branches and tags retain their distinct identities in native badges and accessible names', () => {
  expect([
    commitRefLabel({ kind: 'local-branch', name: 'release' }),
    commitRefLabel({ kind: 'remote-branch', name: 'release' }),
    commitRefLabel({ kind: 'tag', name: 'release' }),
    commitRefLabel({ kind: 'head', name: 'HEAD' }),
  ]).toEqual([
    'Branch release',
    'Remote branch release',
    'Tag release',
    'HEAD',
  ]);
});
