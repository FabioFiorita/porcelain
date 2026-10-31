import type {
  ListFilePreferencesResponse,
  SetFilePreferenceRequest,
} from '@porcelain/contracts/projects';
import { entryName, entryTreeActions } from './tree-actions.ts';
import { quickOpenMatches } from './quick-open.ts';
import { fileTreeAncestors, type FileTreeEntry } from './file-tree.ts';
import type { ListDirectoryResponse } from '@porcelain/contracts/files';

export function filePreferenceEntries({
  entries,
  paths,
  preferences,
  showHidden,
  query,
}: {
  entries: readonly FileTreeEntry[];
  paths: readonly string[];
  preferences: ListFilePreferencesResponse['preferences'];
  showHidden: boolean;
  query: string;
}) {
  const hidden = new Set(
    preferences
      .filter((preference) => preference.hidden)
      .map((preference) => canonicalPreferencePath(preference.path)),
  );
  const pinned = new Set(
    preferences
      .filter((preference) => preference.pinned)
      .map((preference) => canonicalPreferencePath(preference.path)),
  );
  return {
    hidden,
    pinned,
    nodes: entries.filter(
      (entry) =>
        showHidden ||
        hiddenPathFor(canonicalPreferencePath(entry.path), hidden) === null,
    ),
    matches: quickOpenMatches(
      visibleFileTreePaths(paths, hidden, showHidden),
      query,
    ).map((path) => ({ path, kind: 'file' as const })),
    pinnedPaths: visibleFileTreePaths([...pinned], hidden, showHidden),
  };
}

export function filePreferenceActions(
  entry: FileTreeEntry,
  hidden: ReadonlySet<string>,
  pinned: ReadonlySet<string>,
  openToSide: boolean,
) {
  const path = canonicalPreferencePath(entry.path);
  const hiddenEntry = hiddenPathFor(path, hidden);
  return {
    path,
    pin: {
      path,
      flag: 'pinned',
      value: !pinned.has(path),
    } satisfies SetFilePreferenceRequest,
    hide: {
      path: hiddenEntry ?? path,
      flag: 'hidden',
      value: hiddenEntry === null,
    } satisfies SetFilePreferenceRequest,
    actions: entryTreeActions(entry, {
      changed: false,
      hiddenEntry,
      ownHidden: hiddenEntry === path,
      hiddenName: hiddenEntry === null ? '' : entryName(hiddenEntry),
      pinned:
        pinned.has(path) || entry.kind === 'file' || entry.kind === 'directory'
          ? pinned.has(path)
          : undefined,
      openToSideLabel: openToSide ? 'Open to the side' : undefined,
    }).filter(
      ({ id }) =>
        id === 'new-file' ||
        id === 'new-folder' ||
        id === 'open' ||
        id === 'open-to-side' ||
        id === 'rename' ||
        id === 'trash' ||
        id === 'pin' ||
        id === 'hide',
    ),
  };
}

export type PinnedDirectoryState =
  | { readonly path: string; readonly status: 'loading' | 'unavailable' }
  | {
      readonly path: string;
      readonly status: 'loaded';
      readonly entries: ListDirectoryResponse['entries'];
    };

export type PinnedFileEntry =
  | {
      readonly path: string;
      readonly state: 'resolved';
      readonly entry: FileTreeEntry;
    }
  | {
      readonly path: string;
      readonly state: 'loading' | 'unavailable' | 'missing';
    };

export function pinnedParentDirectories(
  preferences: ListFilePreferencesResponse['preferences'],
): string[] {
  return [
    ...new Set(
      preferences
        .filter((preference) => preference.pinned)
        .flatMap((preference) => fileTreeAncestors(preference.path)),
    ),
  ];
}

export function pinnedFileEntries(
  paths: readonly string[],
  directories: readonly PinnedDirectoryState[],
): PinnedFileEntry[] {
  const byPath = new Map(
    directories.map((directory) => [directory.path, directory]),
  );
  const resolve = (path: string): PinnedFileEntry => {
    const parent = fileTreeAncestors(path).at(-1) ?? '';
    const directory = byPath.get(parent);
    if (!directory || directory.status !== 'loaded') {
      if (!directory && parent) {
        const ancestor = resolve(parent);
        if (ancestor.state !== 'resolved')
          return { path, state: ancestor.state };
        if (ancestor.entry.kind !== 'directory')
          return { path, state: 'missing' };
      }
      return { path, state: directory?.status ?? 'loading' };
    }
    const entry = directory.entries.find(
      (entry) => entry.name === entryName(path),
    );
    return entry
      ? {
          path,
          state: 'resolved',
          entry: {
            kind: entry.kind,
            path: `${path}${entry.kind === 'directory' ? '/' : ''}`,
            ...(entry.ignored === undefined ? {} : { ignored: entry.ignored }),
            ...(entry.target === undefined ? {} : { target: entry.target }),
          },
        }
      : { path, state: 'missing' };
  };
  return paths.map((path) => resolve(canonicalPreferencePath(path)));
}

export type SetHiddenInput = { path: string; hidden: boolean };
export type SetPinnedInput = { path: string; pinned: boolean };

export function canonicalPreferencePath(path: string) {
  return path.endsWith('/') ? path.slice(0, -1) : path;
}

export function hiddenPathFor(
  path: string,
  hidden: ReadonlySet<string>,
): string | null {
  if (hidden.has(path)) return path;
  for (const entry of hidden) {
    if (path.startsWith(`${entry}/`)) return entry;
  }
  return null;
}

export function visibleFileTreePaths(
  paths: readonly string[],
  hidden: ReadonlySet<string>,
  showHidden: boolean,
) {
  return showHidden
    ? paths
    : paths.filter((path) => hiddenPathFor(path, hidden) === null);
}

export function hiddenSummary(
  hidden: ReadonlySet<string>,
  kindOf: (path: string) => string | undefined,
): string {
  const kinds = [...hidden].map(kindOf);
  const noun = kinds.every((kind) => kind === 'directory')
    ? 'folder'
    : kinds.every((kind) => kind === 'file')
      ? 'file'
      : 'item';
  return `${hidden.size} hidden ${noun}${hidden.size === 1 ? '' : 's'}`;
}
