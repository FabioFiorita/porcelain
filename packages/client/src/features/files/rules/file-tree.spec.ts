import { expect, test } from 'vitest';
import {
  fileTreeExpansion,
  mergeFileTreeEntries,
  visibleFileTreeRows,
} from './file-tree.ts';
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

test('rows list folders before files at every level, nest under expanded ancestors only and indent by depth', () => {
  const entries = [
    { path: 'README.md', kind: 'file' },
    { path: 'a-link', kind: 'symlink' },
    { path: 'docs/', kind: 'directory' },
    { path: 'docs/guide.md', kind: 'file' },
    { path: 'src/', kind: 'directory' },
    { path: 'src/z.ts', kind: 'file' },
    { path: 'src/lib/', kind: 'directory' },
    { path: 'src/lib/b.ts', kind: 'file' },
    { path: 'src/lib/a.ts', kind: 'file' },
    { path: 'src/lib/deep/', kind: 'directory' },
    { path: 'src/lib/deep/x.ts', kind: 'file' },
  ] as const;
  const rows = (expanded: readonly string[]) =>
    visibleFileTreeRows(entries, new Set(expanded)).map(
      ({ entry, depth }) => `${depth} ${entry.path}`,
    );
  expect(rows(['src', 'src/lib', 'src/lib/deep'])).toEqual([
    '0 docs/',
    '0 src/',
    '1 src/lib/',
    '2 src/lib/deep/',
    '3 src/lib/deep/x.ts',
    '2 src/lib/a.ts',
    '2 src/lib/b.ts',
    '1 src/z.ts',
    '0 a-link',
    '0 README.md',
  ]);
  expect(rows(['src/lib', 'src/lib/deep'])).toEqual([
    '0 docs/',
    '0 src/',
    '0 a-link',
    '0 README.md',
  ]);
});

test('a newly loaded single child of an open parent opens', () => {
  expect(
    fileTreeExpansion(
      [
        { path: 'a', kind: 'directory' },
        { path: 'a/b', kind: 'directory' },
      ],
      new Set(['a']),
      new Set(['a']),
    ),
  ).toEqual(['a', 'a/b']);
});

const directory = (path: string) => ({ path, kind: 'directory' as const });
const file = (path: string) => ({ path, kind: 'file' as const });

test('a new single child stays closed when its parent closed before loading', () => {
  expect(
    fileTreeExpansion(
      [directory('a'), directory('a/b')],
      new Set(),
      new Set(['a']),
    ),
  ).toEqual([]);
});

test('two children prevent continuation, including a file sibling', () => {
  expect(
    fileTreeExpansion(
      [directory('a'), directory('a/b'), directory('a/c')],
      new Set(['a']),
      new Set(['a']),
    ),
  ).toEqual(['a']);
  expect(
    fileTreeExpansion(
      [directory('a'), directory('a/b'), file('a/sibling.txt')],
      new Set(['a']),
      new Set(['a']),
    ),
  ).toEqual(['a']);
});

test('a three-level single-child chain continues in parent order', () => {
  expect(
    fileTreeExpansion(
      [
        directory('a/b/c'),
        file('a/b/c/deep.txt'),
        directory('a/b'),
        directory('a'),
      ],
      new Set(['a']),
      new Set(['a']),
    ),
  ).toEqual(['a', 'a/b', 'a/b/c']);
});

test('a known folder closed by the user stays closed on rebuild', () => {
  expect(
    fileTreeExpansion(
      [directory('a'), directory('a/b'), file('a/b/file.txt')],
      new Set(['a']),
      new Set(['a', 'a/b']),
    ),
  ).toEqual(['a']);
});

test('deleting y after b closes never reopens b above its still-open child x', () => {
  expect(
    fileTreeExpansion(
      [
        directory('a'),
        directory('a/b'),
        directory('a/b/x'),
        file('a/b/x/file.txt'),
      ],
      new Set(['a', 'a/b/x']),
      new Set(['a', 'a/b', 'a/b/x', 'a/b/y']),
    ),
  ).toEqual(['a']);
});

test('new root folders stay closed and removed folders lose expansion', () => {
  expect(
    fileTreeExpansion(
      [directory('a'), directory('new')],
      new Set(['a', 'removed']),
      new Set(['a', 'removed']),
    ),
  ).toEqual(['a']);
});

test('expansion accepts merged folder entries and either folder set convention', () => {
  const entries = mergeFileTreeEntries([
    {
      worktreeId: 'w',
      path: '',
      entries: [{ name: 'a', kind: 'directory' }],
    },
    {
      worktreeId: 'w',
      path: 'a',
      entries: [{ name: 'b', kind: 'directory' }],
    },
    {
      worktreeId: 'w',
      path: 'a/b',
      entries: [{ name: 'file.txt', kind: 'file' }],
    },
  ]);
  expect(fileTreeExpansion(entries, new Set(['a']), new Set(['a']))).toEqual([
    'a',
    'a/b',
  ]);
  expect(fileTreeExpansion(entries, new Set(['a/']), new Set(['a/']))).toEqual([
    'a',
    'a/b',
  ]);
  expect(
    fileTreeExpansion(entries, new Set(['a/']), new Set(['a/', 'a/b/'])),
  ).toEqual(['a']);
});
