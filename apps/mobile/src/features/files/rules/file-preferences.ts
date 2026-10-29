import type {
  ListFilePreferencesResponse,
  SetFilePreferenceRequest,
} from '@porcelain/contracts/projects';
import {
  entryName,
  entryTreeActions,
  fileTreeAncestors,
  visibleFileTreeRows,
  quickOpenMatches,
  type FileTreeEntry,
} from '@porcelain/client/files/rules';
import {
  canonicalPreferencePath,
  hiddenPathFor,
  visibleFileTreePaths,
} from '@porcelain/client/projects/rules';

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
    pinnedEntries: visibleFileTreePaths([...pinned], hidden, showHidden).map(
      (path): FileTreeEntry =>
        entries.find(
          (entry) => canonicalPreferencePath(entry.path) === path,
        ) ?? { path, kind: 'file' },
    ),
  };
}

export function pinnedParentDirectories(
  preferences: ListFilePreferencesResponse['preferences'],
) {
  return [
    ...new Set(
      preferences
        .filter((preference) => preference.pinned)
        .flatMap((preference) => fileTreeAncestors(preference.path)),
    ),
  ];
}

export function pinnedFileTreeRows(
  pins: readonly FileTreeEntry[],
  entries: readonly FileTreeEntry[],
  expanded: ReadonlySet<string>,
) {
  return pins.flatMap((pin) => {
    const path = canonicalPreferencePath(pin.path);
    const ancestors = fileTreeAncestors(pin.path);
    const children =
      pin.kind === 'directory'
        ? entries.filter(
            (entry) =>
              entry.path.startsWith(`${path}/`) && entry.path !== pin.path,
          )
        : [];
    return visibleFileTreeRows(
      [pin, ...children],
      new Set([...expanded, ...ancestors]),
    ).map(({ entry, depth }) => ({
      entry,
      depth: depth - ancestors.length,
      pin: entry.path === pin.path,
      key: `${pin.path}:${entry.path}`,
    }));
  });
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
        entry.kind === 'file' || entry.kind === 'directory'
          ? pinned.has(path)
          : undefined,
      openToSideLabel: openToSide ? 'Open to the side' : undefined,
    })
      .filter(
        ({ id }) =>
          id === 'new-file' ||
          id === 'new-folder' ||
          id === 'open' ||
          id === 'open-to-side' ||
          id === 'rename' ||
          id === 'trash' ||
          id === 'pin' ||
          id === 'hide',
      )
      .map((action) =>
        action.id === 'pin' && entry.kind === 'directory'
          ? {
              ...action,
              label: pinned.has(path) ? 'Unpin folder' : 'Pin folder',
            }
          : action,
      ),
  };
}
