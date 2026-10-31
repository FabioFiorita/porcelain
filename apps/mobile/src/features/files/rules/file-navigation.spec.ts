import { expect, test } from 'vitest';
import {
  pinnedNavigationRows,
  reconcileFileNavigation,
  type FileNavigationState,
} from './file-navigation';

test('removed folders retire expansion and child reads together without losing the saved place', () => {
  const state: FileNavigationState = {
    expanded: new Set(['docs', 'docs/nested', 'src']),
    requested: ['', 'docs', 'docs/nested', 'src'],
    query: '.env',
    showHidden: true,
    selectedPath: 'docs/nested/.env',
  };
  expect(reconcileFileNavigation(state, [])).toBe(state);
  const reconciled = reconcileFileNavigation(state, [
    {
      worktreeId: 'w',
      path: '',
      entries: [{ name: 'src', kind: 'directory' }],
    },
    {
      worktreeId: 'w',
      path: 'docs',
      entries: [{ name: 'nested', kind: 'directory' }],
    },
  ]);
  expect(reconciled).toEqual({
    expanded: new Set(['src']),
    requested: ['', 'src'],
    query: '.env',
    showHidden: true,
    selectedPath: 'docs/nested/.env',
  });
  expect(reconcileFileNavigation(reconciled, [])).toBe(reconciled);
});

test('expanded pinned folder descendants are list rows with depth relative to the pin', () => {
  const rows = pinnedNavigationRows(
    [
      {
        path: 'deep/docs',
        state: 'resolved',
        entry: { path: 'deep/docs/', kind: 'directory' },
      },
    ],
    [
      { path: 'deep/docs/', kind: 'directory' },
      { path: 'deep/docs/guide.md', kind: 'file' },
      { path: 'deep/docs/nested/', kind: 'directory' },
      { path: 'deep/docs/nested/secret.md', kind: 'file' },
      { path: 'other.md', kind: 'file' },
    ],
    new Set(['deep/docs']),
  );
  expect(rows.map(({ entry, depth }) => [entry.path, depth])).toEqual([
    ['deep/docs/', 0],
    ['deep/docs/nested/', 1],
    ['deep/docs/guide.md', 1],
  ]);
});

test('large pinned folders produce individually virtualizable rows rather than nested trees', () => {
  const children = Array.from({ length: 1200 }, (_, index) => ({
    path: `docs/file-${index}.ts`,
    kind: 'file' as const,
  }));
  const pin = {
    path: 'docs',
    state: 'resolved' as const,
    entry: { path: 'docs/', kind: 'directory' as const },
  };
  expect(pinnedNavigationRows([pin], children, new Set(['docs']))).toHaveLength(
    1201,
  );
  expect(pinnedNavigationRows([pin], children, new Set())).toHaveLength(1);
});

test('unavailable pins stay in the list with their own path and availability', () => {
  expect(
    pinnedNavigationRows(
      [{ path: 'docs', state: 'unavailable' }],
      [],
      new Set(),
    ),
  ).toEqual([
    {
      key: 'pinned:docs',
      entry: { path: 'docs', kind: 'other' },
      depth: 0,
      pinned: true,
      availability: 'unavailable',
    },
  ]);
});
