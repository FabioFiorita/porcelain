import { expect, test } from 'vitest';
import type { FileTreeEntry } from '@porcelain/client/files/rules';
import {
  filePreferenceActions,
  filePreferenceEntries,
  pinnedParentDirectories,
  pinnedFileTreeRows,
} from './file-preferences';

const entries: readonly FileTreeEntry[] = [
  { path: 'docs/', kind: 'directory' },
  { path: 'docs/guide.md', kind: 'file' },
  { path: 'docs/private/', kind: 'directory' },
  { path: 'docs/private/secret.md', kind: 'file' },
  { path: 'docs-other.md', kind: 'file' },
  { path: 'README.md', kind: 'file' },
];
const preferences = [
  { path: 'docs', hidden: true, pinned: false },
  { path: 'docs/private', hidden: true, pinned: false },
  { path: 'docs/guide.md', hidden: false, pinned: true },
  { path: 'README.md', hidden: false, pinned: true },
];
const input = {
  entries,
  paths: [
    'docs/guide.md',
    'docs/private/secret.md',
    'docs-other.md',
    'README.md',
  ],
  preferences,
  query: 'docs',
};

test('hidden directories and descendants disappear from tree, search and pinned files without hiding sibling prefixes', () => {
  const result = filePreferenceEntries({ ...input, showHidden: false });
  expect(result.nodes.map((entry) => entry.path)).toEqual([
    'docs-other.md',
    'README.md',
  ]);
  expect(result.matches).toEqual([{ path: 'docs-other.md', kind: 'file' }]);
  expect(result.pinnedEntries.map((entry) => entry.path)).toEqual([
    'README.md',
  ]);
  expect(result.hidden.size).toBe(2);
  expect(result.pinned.has('docs/guide.md')).toBe(true);
});

test('show hidden restores the same tree, search and pinned paths while leaving saved preferences intact', () => {
  const savedPreferences = structuredClone(preferences);
  const result = filePreferenceEntries({ ...input, showHidden: true });
  expect(result.nodes).toEqual(entries);
  expect(result.matches.map((entry) => entry.path).sort()).toEqual([
    'docs-other.md',
    'docs/guide.md',
    'docs/private/secret.md',
  ]);
  expect(result.pinnedEntries.map((entry) => entry.path)).toEqual([
    'docs/guide.md',
    'README.md',
  ]);
  expect(preferences).toEqual(savedPreferences);
});

test('durable pins remain reachable before their containing directory has been read', () => {
  expect(
    filePreferenceEntries({
      ...input,
      entries: [],
      paths: [],
      showHidden: true,
    }).pinnedEntries.map((entry) => entry.path),
  ).toEqual(['docs/guide.md', 'README.md']);
});

test('files can be pinned and unpinned with an optional side action', () => {
  const file = { path: 'README.md', kind: 'file' as const };
  const unpinned = filePreferenceActions(file, new Set(), new Set(), true);
  expect(unpinned.actions).toContainEqual({ id: 'pin', label: 'Pin file' });
  expect(unpinned.pin).toEqual({
    path: 'README.md',
    flag: 'pinned',
    value: true,
  });
  expect(unpinned.hide).toEqual({
    path: 'README.md',
    flag: 'hidden',
    value: true,
  });
  expect(unpinned.actions).toContainEqual({
    id: 'open-to-side',
    label: 'Open to the side',
  });
  const pinned = filePreferenceActions(
    file,
    new Set(),
    new Set(['README.md']),
    false,
  );
  expect(pinned.actions).toContainEqual({ id: 'pin', label: 'Unpin file' });
  expect(pinned.pin).toEqual({
    path: 'README.md',
    flag: 'pinned',
    value: false,
  });
  expect(pinned.actions.some(({ id }) => id === 'open-to-side')).toBe(false);
});

test.each(['symlink', 'submodule', 'other'] as const)(
  '%s entries have no pin or side action',
  (kind) => {
    const result = filePreferenceActions(
      { path: 'docs/', kind },
      new Set(),
      new Set(),
      true,
    );
    expect(result.actions.some(({ id }) => id === 'pin')).toBe(false);
    expect(result.actions.some(({ id }) => id === 'open-to-side')).toBe(false);
  },
);

test('show file and folder requests clear their canonical preference, including a trailing directory slash', () => {
  const hidden = new Set(['README.md', 'docs']);
  const file = filePreferenceActions(
    { path: 'README.md', kind: 'file' },
    hidden,
    new Set(),
    false,
  );
  expect(file.actions).toContainEqual({ id: 'hide', label: 'Show file' });
  expect(file.hide).toEqual({
    path: 'README.md',
    flag: 'hidden',
    value: false,
  });
  const folder = filePreferenceActions(
    { path: 'docs/', kind: 'directory' },
    hidden,
    new Set(),
    false,
  );
  expect(folder.actions).toContainEqual({ id: 'hide', label: 'Show folder' });
  expect(folder.hide).toEqual({ path: 'docs', flag: 'hidden', value: false });
});

test('an inherited Show action clears the actual hidden ancestor rather than writing an ineffective child preference', () => {
  const file = { path: 'docs/private/secret.md', kind: 'file' as const };
  const first = filePreferenceActions(
    file,
    new Set(['docs', 'docs/private']),
    new Set(),
    false,
  );
  expect(first.actions).toContainEqual({ id: 'hide', label: 'Show docs' });
  expect(first.hide).toEqual({ path: 'docs', flag: 'hidden', value: false });
  const second = filePreferenceActions(
    file,
    new Set(['docs/private']),
    new Set(),
    false,
  );
  expect(second.actions).toContainEqual({ id: 'hide', label: 'Show private' });
  expect(second.hide).toEqual({
    path: 'docs/private',
    flag: 'hidden',
    value: false,
  });
});

test.each([false, true])(
  'folders can be pinned and unpinned (pinned: %s)',
  (pinned) => {
    const result = filePreferenceActions(
      { path: 'docs/private/', kind: 'directory' },
      new Set(),
      new Set(pinned ? ['docs/private'] : []),
      true,
    );
    expect(result.actions).toContainEqual({
      id: 'pin',
      label: pinned ? 'Unpin folder' : 'Pin folder',
    });
    expect(result.pin).toEqual({
      path: 'docs/private',
      flag: 'pinned',
      value: !pinned,
    });
    expect(
      result.actions.some(({ id }) => id === 'open' || id === 'open-to-side'),
    ).toBe(false);
  },
);

test('pinned folders retain directory ownership, including empty folders, and respect hidden ancestors', () => {
  const ownedEntries: readonly FileTreeEntry[] = [
    ...entries,
    { path: 'empty/', kind: 'directory' },
  ];
  const pinned = [
    { path: 'empty', hidden: false, pinned: true },
    { path: 'docs', hidden: false, pinned: true },
    { path: 'docs/private', hidden: true, pinned: true },
    { path: 'README.md', hidden: false, pinned: true },
  ];
  expect(
    filePreferenceEntries({
      ...input,
      entries: ownedEntries,
      preferences: pinned,
      showHidden: false,
    }).pinnedEntries,
  ).toEqual([
    { path: 'empty/', kind: 'directory' },
    { path: 'docs/', kind: 'directory' },
    { path: 'README.md', kind: 'file' },
  ]);
  expect(
    filePreferenceEntries({
      ...input,
      entries: ownedEntries,
      preferences: pinned,
      showHidden: true,
    }).pinnedEntries,
  ).toEqual([
    { path: 'empty/', kind: 'directory' },
    { path: 'docs/', kind: 'directory' },
    { path: 'docs/private/', kind: 'directory' },
    { path: 'README.md', kind: 'file' },
  ]);
});

test('reading pinned parents identifies nested and empty folders without expanding them', () => {
  expect(
    pinnedParentDirectories([
      { path: 'docs/private/empty', hidden: false, pinned: true },
      { path: 'docs/guide.md', hidden: false, pinned: true },
      { path: 'README.md', hidden: false, pinned: true },
      { path: 'unread/deep/file.ts', hidden: false, pinned: false },
    ]),
  ).toEqual(['docs', 'docs/private']);
  expect(pinnedParentDirectories([])).toEqual([]);
});

test('pinned folders expand directly beneath their pin without requiring their ancestors to be expanded', () => {
  const pins: FileTreeEntry[] = [{ path: 'docs/private/', kind: 'directory' }];
  const collapsed = pinnedFileTreeRows(pins, entries, new Set());
  expect(
    collapsed.map(({ entry, depth, pin }) => [entry.path, depth, pin]),
  ).toEqual([['docs/private/', 0, true]]);
  const expanded = pinnedFileTreeRows(pins, entries, new Set(['docs/private']));
  expect(
    expanded.map(({ entry, depth, pin }) => [entry.path, depth, pin]),
  ).toEqual([
    ['docs/private/', 0, true],
    ['docs/private/secret.md', 1, false],
  ]);
  expect(pinnedFileTreeRows([], entries, new Set())).toEqual([]);
});
