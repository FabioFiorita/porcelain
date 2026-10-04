import { expect, test } from 'vitest';
import {
  commitFileLabel,
  commitFilePaths,
  type CommitFile,
} from './commit-file.ts';

const file = (paths: Partial<CommitFile>): CommitFile => ({
  status: 'modified',
  oldPath: 'README.md',
  newPath: 'README.md',
  oldMode: '100644',
  newMode: '100644',
  ...paths,
});

test('request one path for edits, the surviving path for additions and deletions, and both sides of a rename', () => {
  expect(commitFilePaths(file({}))).toEqual(['README.md']);
  expect(
    commitFilePaths(file({ status: 'added', oldPath: undefined })),
  ).toEqual(['README.md']);
  expect(
    commitFilePaths(file({ status: 'deleted', newPath: undefined })),
  ).toEqual(['README.md']);
  expect(
    commitFilePaths(file({ status: 'renamed', newPath: 'GUIDE.md' })),
  ).toEqual(['README.md', 'GUIDE.md']);
});

test('show changed paths without losing a deletion or the old side of a rename', () => {
  expect(commitFileLabel(file({}))).toBe('README.md');
  expect(commitFileLabel(file({ status: 'added', oldPath: undefined }))).toBe(
    'README.md',
  );
  expect(commitFileLabel(file({ status: 'deleted', newPath: undefined }))).toBe(
    'README.md',
  );
  expect(
    commitFileLabel(file({ status: 'renamed', newPath: 'GUIDE.md' })),
  ).toBe('README.md → GUIDE.md');
});
