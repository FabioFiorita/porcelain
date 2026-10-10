import { expect, it } from 'vitest';
import { diffSelection } from './selection.ts';
it.each(['staged', 'unstaged'] as const)(
  'keeps both rename paths for %s',
  (scope) => {
    expect(
      diffSelection({
        scope,
        kind: 'renamed',
        oldPath: 'before.ts',
        newPath: 'after.ts',
        oldMode: '100644',
        newMode: '100644',
        oldOid: 'a',
        newOid: 'b',
        supported: true,
      }),
    ).toEqual({ scope, oldPath: 'before.ts', newPath: 'after.ts' });
  },
);
it('never submits an untracked path as a staged or unstaged diff', () => {
  expect(diffSelection({ scope: 'untracked', path: 'new.ts' })).toBeUndefined();
});
it('never submits a conflict as a two-sided diff', () => {
  expect(
    diffSelection({
      scope: 'unmerged',
      path: 'conflict.ts',
      conflict: 'both-modified',
    }),
  ).toBeUndefined();
});
