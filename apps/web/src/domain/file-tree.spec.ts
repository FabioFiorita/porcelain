import { describe, expect, it } from 'vitest';
import {
  fileTreeAncestors,
  fileTreeEntries,
  mergeFileTreeEntries,
} from './file-tree';

describe('file tree paths', () => {
  it('keeps empty directories explicit and non-directories as leaves', () => {
    expect(
      fileTreeEntries({
        worktreeId: '629a86281cd6456281a29c05fba76b4b',
        path: 'src',
        entries: [
          { name: 'empty', kind: 'directory' },
          { name: 'index.ts', kind: 'file' },
          { name: 'linked', kind: 'symlink' },
        ],
      }),
    ).toEqual([
      { path: 'src/empty/', kind: 'directory' },
      { path: 'src/index.ts', kind: 'file' },
      { path: 'src/linked', kind: 'symlink' },
    ]);
  });

  it('derives query paths for every selected-file ancestor', () => {
    expect(fileTreeAncestors('src/views/review/file.tsx')).toEqual([
      'src',
      'src/views',
      'src/views/review',
    ]);
  });

  it('merges repeated directory observations by path', () => {
    const root = {
      worktreeId: '629a86281cd6456281a29c05fba76b4b',
      path: '',
      entries: [{ name: 'src', kind: 'directory' as const }],
    };
    expect(mergeFileTreeEntries([root, root])).toEqual([
      { path: 'src/', kind: 'directory' },
    ]);
  });

  it('drops cached descendants after their parent disappears', () => {
    expect(
      mergeFileTreeEntries([
        {
          worktreeId: '629a86281cd6456281a29c05fba76b4b',
          path: '',
          entries: [{ name: 'README.md', kind: 'file' }],
        },
        {
          worktreeId: '629a86281cd6456281a29c05fba76b4b',
          path: 'removed',
          entries: [{ name: 'stale.ts', kind: 'file' }],
        },
      ]),
    ).toEqual([{ path: 'README.md', kind: 'file' }]);
  });
});
