import { describe, expect, it, test } from 'vitest';
import type { FileTreeEntry } from '@porcelain/client/files/rules';
import {
  canonicalPreferencePath,
  hiddenPathFor,
  hiddenSummary,
  visibleFileTreePaths,
  filePreferenceActions,
  filePreferenceEntries,
  pinnedFileEntries,
  pinnedParentDirectories,
} from './file-preferences.ts';

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
  const savedPreferences = structuredClone(preferences);
  const result = filePreferenceEntries({ ...input, showHidden: true });
  expect(result.nodes).toEqual(entries);
  expect(result.matches.map((entry) => entry.path).sort()).toEqual([
    'docs-other.md',
    'docs/guide.md',
    'docs/private/secret.md',
  ]);
  expect(result.pinnedPaths).toEqual(['docs/guide.md', 'README.md']);
  expect(preferences).toEqual(savedPreferences);
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
  expect(unpinned.actions).toContainEqual({
    id: 'timeline',
    label: 'Show timeline',
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

test('folder pins use folder labels and canonical paths', () => {
  const result = filePreferenceActions(
    { path: 'docs/', kind: 'directory' },
    new Set(),
    new Set(),
    false,
  );
  expect(result.actions).toContainEqual({ id: 'pin', label: 'Pin folder' });
  expect(result.pin).toEqual({ path: 'docs', flag: 'pinned', value: true });
  expect(
    filePreferenceActions(
      { path: 'docs/', kind: 'directory' },
      new Set(),
      new Set(['docs']),
      false,
    ).actions,
  ).toContainEqual({ id: 'pin', label: 'Unpin folder' });
});

test.each(['symlink', 'submodule', 'other'] as const)(
  'existing %s pins remain removable',
  (kind) => {
    const result = filePreferenceActions(
      { path: 'old', kind },
      new Set(),
      new Set(['old']),
      false,
    );
    expect(result.actions).toContainEqual({ id: 'pin', label: 'Unpin file' });
    expect(result.pin).toEqual({ path: 'old', flag: 'pinned', value: false });
  },
);

test('pinned entry kind comes from its actual parent listing, including a known dotfile', () => {
  expect(
    pinnedFileEntries(
      ['docs', 'docs/.env'],
      [
        {
          path: '',
          status: 'loaded',
          entries: [{ name: 'docs', kind: 'directory' }],
        },
        {
          path: 'docs',
          status: 'loaded',
          entries: [{ name: '.env', kind: 'file', ignored: true }],
        },
      ],
    ),
  ).toEqual([
    {
      path: 'docs',
      state: 'resolved',
      entry: { path: 'docs/', kind: 'directory' },
    },
    {
      path: 'docs/.env',
      state: 'resolved',
      entry: { path: 'docs/.env', kind: 'file', ignored: true },
    },
  ]);
});

test('unread, failed and missing parent listings never invent a pinned file kind', () => {
  expect(pinnedFileEntries(['docs/.env'], [])).toEqual([
    { path: 'docs/.env', state: 'loading' },
  ]);
  expect(
    pinnedFileEntries(['docs/.env'], [{ path: 'docs', status: 'unavailable' }]),
  ).toEqual([{ path: 'docs/.env', state: 'unavailable' }]);
  expect(
    pinnedFileEntries(['docs/.env'], [{ path: '', status: 'unavailable' }]),
  ).toEqual([{ path: 'docs/.env', state: 'unavailable' }]);
  expect(
    pinnedFileEntries(
      ['docs/.env'],
      [{ path: '', status: 'loaded', entries: [] }],
    ),
  ).toEqual([{ path: 'docs/.env', state: 'missing' }]);
  expect(
    pinnedFileEntries(
      ['docs/.env'],
      [{ path: 'docs', status: 'loaded', entries: [] }],
    ),
  ).toEqual([{ path: 'docs/.env', state: 'missing' }]);
});

test('pinned parents are deduplicated and ordered before descendants without reading pinned files as directories', () => {
  expect(
    pinnedParentDirectories([
      { path: 'docs/private/.env', hidden: false, pinned: true },
      { path: 'docs/guide.md', hidden: false, pinned: true },
      { path: 'ignored/README.md', hidden: false, pinned: false },
    ]),
  ).toEqual(['docs', 'docs/private']);
});

describe('hidden project paths', () => {
  it('hides a selected directory and its children without hiding a similarly named sibling', () => {
    const hidden = new Set(['src/private']);
    expect(hiddenPathFor('src/private/key.txt', hidden)).toBe('src/private');
    expect(hiddenPathFor('src/private-copy/key.txt', hidden)).toBeNull();
    expect(
      visibleFileTreePaths(
        ['src/private/key.txt', 'src/private-copy/key.txt'],
        hidden,
        false,
      ),
    ).toEqual(['src/private-copy/key.txt']);
    expect(visibleFileTreePaths(['src/private/key.txt'], hidden, true)).toEqual(
      ['src/private/key.txt'],
    );
  });

  it('removes a trailing directory separator before saving a preference', () => {
    expect(canonicalPreferencePath('src/private/')).toBe('src/private');
  });
});

it.each([[['docs', 'scripts', 'tests'], '3 hidden folders']] as const)(
  'summarises hidden %j as %s',
  (paths, summary) => {
    const kinds = new Map<string, string>([
      ['docs', 'directory'],
      ['scripts', 'directory'],
      ['tests', 'directory'],
      ['secrets.env', 'file'],
      ['.envrc', 'file'],
    ]);
    expect(hiddenSummary(new Set(paths), (path) => kinds.get(path))).toBe(
      summary,
    );
  },
);
