import { describe, expect, it } from 'vitest';
import {
  canDropPaths,
  directoryPaths,
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
      'Open diff',
      'Open file',
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
});
