import { expect, it } from 'vitest';
import {
  commitPaths,
  commitPath,
  historyBoundary,
  historyHeading,
  patchUnavailable,
} from './presentation.ts';
const file = {
  status: 'modified' as const,
  oldMode: '100644',
  newMode: '100644',
};
it('keeps both rename paths and the surviving path for additions and deletions', () => {
  expect(
    commitPaths({ ...file, oldPath: 'before.ts', newPath: 'after.ts' }),
  ).toEqual(['before.ts', 'after.ts']);
  expect(
    commitPaths({ ...file, oldPath: 'same.ts', newPath: 'same.ts' }),
  ).toEqual(['same.ts']);
  expect(
    commitPaths({ ...file, oldPath: undefined, newPath: 'added.ts' }),
  ).toEqual(['added.ts']);
  expect(
    commitPaths({ ...file, oldPath: 'deleted.ts', newPath: undefined }),
  ).toEqual(['deleted.ts']);
  expect(
    commitPath({ ...file, oldPath: 'before.ts', newPath: 'after.ts' }),
  ).toBe('after.ts');
  expect(
    commitPath({ ...file, oldPath: 'deleted.ts', newPath: undefined }),
  ).toBe('deleted.ts');
});
it('shows the actual branch state and history boundary', () => {
  expect(
    historyHeading({
      tipOid: undefined,
      head: { kind: 'unborn', ref: 'refs/heads/new' },
    }),
  ).toBe('No commits yet on new');
  expect(
    historyHeading({
      tipOid: undefined,
      head: { kind: 'attached', ref: 'refs/heads/main' },
    }),
  ).toBe('main');
  expect(
    historyHeading({ tipOid: undefined, head: { kind: 'detached' } }),
  ).toBe('Detached HEAD');
  expect(historyBoundary('shallow')).toBe(
    'Shallow clone: older history is not available.',
  );
  expect(historyBoundary('wide')).toBe(
    'Too many branches meet here to continue past this point.',
  );
  expect(historyBoundary(undefined)).toBe('Start of history.');
});
it.each([
  [{ kind: 'binary' }, 'Binary change'],
  [
    { kind: 'metadata-only', patch: 'old mode 100644\nnew mode 100755' },
    'No code change',
  ],
  [{ kind: 'omitted', reason: 'size-limit' }, 'Too large to show'],
  [{ kind: 'omitted', reason: 'unsupported-encoding' }, 'Cannot be shown'],
  [{ kind: 'omitted', reason: 'unsupported-submodule' }, 'Submodule change'],
  [{ kind: 'text', patch: '@@ -1 +1 @@\n-before\n+after' }, undefined],
] as const)('labels %j without inventing a text preview', (content, label) => {
  expect(patchUnavailable(content)).toBe(label);
});
