import { describe, expect, it } from 'vitest';
import {
  canDropPaths,
  directoryPaths,
  duplicatePath,
  entryName,
  nextCreatePath,
  selectedDirectories,
  topLevelDraggedPaths,
  treeActions,
} from './tree-actions.ts';

describe('file tree actions', () => {
  it('chooses a free inline name in the requested folder', () => {
    const existing = new Set([
      'docs/untitled',
      'docs/untitled-2',
      'docs/new-folder/',
    ]);
    expect(nextCreatePath('file', 'docs/', (path) => existing.has(path))).toBe(
      'docs/untitled-3',
    );
    expect(
      nextCreatePath('directory', 'docs/', (path) => existing.has(path)),
    ).toBe('docs/new-folder-2/');
  });

  it('keeps only top level dragged entries', () => {
    expect(topLevelDraggedPaths(['src/', 'src/a.ts', 'README.md'])).toEqual([
      'src/',
      'README.md',
    ]);
    expect(canDropPaths(['src/'], 'src/nested/')).toBe(false);
    expect(canDropPaths(['README.md'], 'src/')).toBe(true);
    expect(entryName('src/nested/')).toBe('nested');
    expect(directoryPaths(['src/', 'README.md'])).toEqual(['src/']);
    expect(selectedDirectories('src/nested/README.md')).toEqual([
      'src/',
      'src/nested/',
    ]);
  });

  it('offers file actions according to entry kind and hidden state', () => {
    expect(
      treeActions({
        folder: false,
        link: false,
        changed: true,
        openable: true,
        hiddenEntry: null,
        ownHidden: false,
        hiddenName: '',
      }).map((action) => action.label),
    ).toEqual([
      'Rename',
      'Duplicate',
      'Open diff',
      'Open file',
      'Show timeline',
      'Hide file',
      'Copy relative path',
      'Copy full path',
      'Move to trash',
    ]);
    expect(
      treeActions({
        folder: true,
        link: true,
        changed: false,
        openable: false,
        hiddenEntry: 'docs/',
        ownHidden: true,
        hiddenName: 'docs',
      }).map((action) => action.label),
    ).toEqual([
      'Show folder',
      'Copy relative path',
      'Copy full path',
      'Move to trash',
    ]);
  });

  it('offers to pin a file that is not pinned and to unpin one that is', () => {
    const file = {
      folder: false,
      link: false,
      changed: false,
      openable: true,
      hiddenEntry: null,
      ownHidden: false,
      hiddenName: '',
    };
    expect(
      treeActions({ ...file, pinned: false }).map((action) => action.label),
    ).toEqual([
      'Rename',
      'Duplicate',
      'Open',
      'Show timeline',
      'Pin file',
      'Hide file',
      'Copy relative path',
      'Copy full path',
      'Move to trash',
    ]);
    expect(
      treeActions({ ...file, pinned: true }).find(
        (action) => action.id === 'pin',
      )?.label,
    ).toBe('Unpin file');
  });

  it('names a duplicate after the file with copy before its extension, numbering further copies', () => {
    const existing = new Set(['docs/notes copy.md', 'docs/notes copy 2.md']);
    expect(duplicatePath('README.md', () => false)).toBe('README copy.md');
    expect(duplicatePath('docs/notes.md', (path) => existing.has(path))).toBe(
      'docs/notes copy 3.md',
    );
    expect(duplicatePath('Makefile', () => false)).toBe('Makefile copy');
    expect(duplicatePath('.env', () => false)).toBe('.env copy');
    expect(duplicatePath('archive.tar.gz', () => false)).toBe(
      'archive.tar copy.gz',
    );
  });
});
