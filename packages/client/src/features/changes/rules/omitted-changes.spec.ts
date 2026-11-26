import { expect, it } from 'vite-plus/test';
import { changedFileCount, shownChangesText } from './omitted-changes.ts';

it('counts each changed file once and adds the files the server left out', () => {
  expect(
    changedFileCount({
      changes: [
        {
          scope: 'staged',
          kind: 'modified',
          oldPath: 'a.ts',
          newPath: 'a.ts',
          oldMode: '100644',
          newMode: '100644',
          oldOid: 'a'.repeat(40),
          newOid: 'b'.repeat(40),
          supported: true,
        },
        {
          scope: 'unstaged',
          kind: 'modified',
          oldPath: 'a.ts',
          newPath: 'a.ts',
          oldMode: '100644',
          newMode: '100644',
          oldOid: 'b'.repeat(40),
          newOid: undefined,
          supported: true,
        },
        { scope: 'untracked', path: 'b.ts' },
      ],
      omittedChanges: 3000,
    }),
  ).toBe(3002);
});

it('says how many of all changes are shown only when some were left out', () => {
  expect(shownChangesText(2000, 3000)).toBe('2,000 of 5,000 changes shown');
  expect(shownChangesText(12, undefined)).toBeUndefined();
});
