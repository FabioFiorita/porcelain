import { expect, test } from 'vitest';
import { directoryTree } from './file-tree';

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
  expect(directoryTree(directories)).toEqual([
    {
      id: 'src',
      name: 'src',
      kind: 'folder',
      children: [
        { id: 'src/logo.PNG', name: 'logo.PNG', kind: 'image' },
        { id: 'src/main.ts', name: 'main.ts', kind: 'file', status: 'Ignored' },
      ],
    },
    { id: 'README.md', name: 'README.md', kind: 'file' },
    { id: 'shortcut', name: 'shortcut', kind: 'file', status: 'Symlink' },
  ]);
  expect(directoryTree(directories.slice(1))).toEqual([]);
});

test('an unread folder stays an expandable folder and submodules stay leaf notices', () => {
  expect(
    directoryTree([
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
    { id: 'empty', name: 'empty', kind: 'folder', children: [] },
    { id: 'pipe', name: 'pipe', kind: 'file', status: 'Unsupported' },
    { id: 'vendor', name: 'vendor', kind: 'file', status: 'Submodule' },
  ]);
});
