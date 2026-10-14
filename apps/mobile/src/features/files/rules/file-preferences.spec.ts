import { expect, test } from 'vitest';
import type { FileTreeEntry } from '@porcelain/client/files/rules';
import {
  filePreferenceActions,
  filePreferenceEntries,
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
  expect(result.pinnedPaths).toEqual(['README.md']);
  expect(result.hidden.size).toBe(2);
  expect(result.pinned.has('docs/guide.md')).toBe(true);
});

test('show hidden restores the same tree, search and pinned paths while leaving saved preferences intact', () => {
  const result = filePreferenceEntries({ ...input, showHidden: true });
  expect(result.nodes).toEqual(entries);
  expect(result.matches.map((entry) => entry.path).sort()).toEqual([
    'docs-other.md',
    'docs/guide.md',
    'docs/private/secret.md',
  ]);
  expect(result.pinnedPaths).toEqual(['docs/guide.md', 'README.md']);
  expect(preferences).toEqual([
    { path: 'docs', hidden: true, pinned: false },
    { path: 'docs/private', hidden: true, pinned: false },
    { path: 'docs/guide.md', hidden: false, pinned: true },
    { path: 'README.md', hidden: false, pinned: true },
  ]);
});

test('durable pins remain reachable before their containing directory has been read', () => {
  expect(
    filePreferenceEntries({
      ...input,
      entries: [],
      paths: [],
      showHidden: true,
    }).pinnedPaths,
  ).toEqual(['docs/guide.md', 'README.md']);
});

test('files can be pinned and unpinned, while folders and links have no pin or side action', () => {
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
  for (const kind of ['directory', 'symlink', 'submodule', 'other'] as const) {
    const result = filePreferenceActions(
      { path: 'docs/', kind },
      new Set(),
      new Set(),
      true,
    );
    expect(result.actions.some(({ id }) => id === 'pin')).toBe(false);
    expect(result.actions.some(({ id }) => id === 'open-to-side')).toBe(false);
  }
});

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
