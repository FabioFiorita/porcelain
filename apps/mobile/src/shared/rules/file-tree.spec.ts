import { expect, test } from 'vitest';
import {
  directoryRequests,
  directoryTree,
  isNativeImagePath,
  sourceLanguage,
} from './file-tree';

test('renamed and removed ancestors stop directory reads, including stale descendants', () => {
  expect(
    directoryRequests(
      ['', 'src', 'src/nested', 'docs', 'docs/archive'],
      [
        {
          worktreeId: 'w',
          path: '',
          entries: [
            { name: 'source', kind: 'directory' },
            { name: 'docs', kind: 'file' },
          ],
        },
        {
          worktreeId: 'w',
          path: 'src',
          entries: [{ name: 'nested', kind: 'directory' }],
        },
      ],
    ),
  ).toEqual(['']);
});

test('unread parents preserve pending reads and current directories remain requested', () => {
  const requested = ['', 'src', 'src/nested', 'src/nested/deep'];
  expect(directoryRequests(requested, [])).toEqual(requested);
  expect(
    directoryRequests(requested, [
      {
        worktreeId: 'w',
        path: '',
        entries: [{ name: 'src', kind: 'directory' }],
      },
      {
        worktreeId: 'w',
        path: 'src',
        entries: [{ name: 'nested', kind: 'directory' }],
      },
    ]),
  ).toEqual(requested);
});

test('SVG files use editable source while bitmap images keep native previews', () => {
  expect(isNativeImagePath('assets/logo.SVG')).toBe(false);
  expect(sourceLanguage('assets/logo.SVG')).toBe('xml');
  expect(isNativeImagePath('assets/photo.PNG')).toBe(true);
  expect(isNativeImagePath('assets/photo.jpg')).toBe(true);
  expect(isNativeImagePath('src/main.ts')).toBe(false);
});

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
