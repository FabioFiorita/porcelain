import { expect, test } from 'vitest';
import { mergeFileTreeEntries } from './file-tree.ts';
test('folder reads attach only to currently reachable parents and preserve file identities', () => {
  const directories = [
    {
      worktreeId: 'w',
      path: '',
      entries: [
        { name: 'README.md', kind: 'file' as const },
        { name: 'src', kind: 'directory' as const },
        { name: 'shortcut', kind: 'symlink' as const, target: '../outside' },
      ],
    },
    {
      worktreeId: 'w',
      path: 'src',
      entries: [
        { name: 'main.ts', kind: 'file' as const, ignored: true },
        { name: 'logo.PNG', kind: 'file' as const },
      ],
    },
    {
      worktreeId: 'w',
      path: 'deleted',
      entries: [{ name: 'stale.ts', kind: 'file' as const }],
    },
    {
      worktreeId: 'w',
      path: 'shortcut',
      entries: [{ name: 'outside.txt', kind: 'file' as const }],
    },
  ];
  expect(mergeFileTreeEntries(directories)).toEqual([
    { path: 'README.md', kind: 'file' },
    { path: 'shortcut', kind: 'symlink', target: '../outside' },
    { path: 'src/', kind: 'directory' },
    { path: 'src/logo.PNG', kind: 'file' },
    { path: 'src/main.ts', kind: 'file', ignored: true },
  ]);
  expect(mergeFileTreeEntries(directories.slice(1))).toEqual([]);
});

test('an unread folder stays an expandable folder and submodules stay leaf notices', () => {
  expect(
    mergeFileTreeEntries([
      {
        worktreeId: 'w',
        path: '',
        entries: [
          { name: 'vendor', kind: 'submodule' },
          { name: 'empty', kind: 'directory' },
          { name: 'pipe', kind: 'other' },
        ],
      },
    ]),
  ).toEqual([
    { path: 'empty/', kind: 'directory' },
    { path: 'pipe', kind: 'other' },
    { path: 'vendor', kind: 'submodule' },
  ]);
});

test('attaches nested directories at two levels and keeps target and ignored metadata', () => {
  expect(
    mergeFileTreeEntries([
      {
        worktreeId: 'w',
        path: '',
        entries: [{ name: 'src', kind: 'directory' }],
      },
      {
        worktreeId: 'w',
        path: 'src',
        entries: [{ name: 'nested', kind: 'directory', ignored: true }],
      },
      {
        worktreeId: 'w',
        path: 'src/nested',
        entries: [
          { name: 'link', kind: 'symlink', target: '../../target' },
          { name: 'deep.ts', kind: 'file' },
        ],
      },
    ]),
  ).toEqual([
    { path: 'src/', kind: 'directory' },
    { path: 'src/nested/', kind: 'directory', ignored: true },
    { path: 'src/nested/deep.ts', kind: 'file' },
    { path: 'src/nested/link', kind: 'symlink', target: '../../target' },
  ]);
});
