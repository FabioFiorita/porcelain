import {
  fileTreeAncestors,
  visibleFileTreeRows,
  type FileTreeEntry,
  type PinnedFileEntry,
} from '@porcelain/client/files/rules';
import type { ListDirectoryResponse } from '@porcelain/contracts/files';
import { directoryRequests } from './directory-requests';

export type FileNavigationState = {
  readonly expanded: ReadonlySet<string>;
  readonly requested: readonly string[];
  readonly query: string;
  readonly showHidden: boolean;
  readonly selectedPath: string | undefined;
};

export function reconcileFileNavigation(
  state: FileNavigationState,
  directories: readonly ListDirectoryResponse[],
): FileNavigationState {
  const requested = directoryRequests(state.requested, directories);
  if (requested.length === state.requested.length) return state;
  return {
    ...state,
    requested,
    expanded: new Set(
      [...state.expanded].filter((path) => requested.includes(path)),
    ),
  };
}

type PinnedNavigationRow = {
  key: string;
  entry: FileTreeEntry;
  depth: number;
  pinned: boolean;
  availability: 'loading' | 'missing' | 'unavailable' | undefined;
};

export function pinnedNavigationRows(
  pins: readonly PinnedFileEntry[],
  entries: readonly FileTreeEntry[],
  expanded: ReadonlySet<string>,
): PinnedNavigationRow[] {
  return pins.flatMap<PinnedNavigationRow>((pin) => {
    if (pin.state !== 'resolved')
      return [
        {
          key: `pinned:${pin.path}`,
          entry: { path: pin.path, kind: 'other' as const },
          depth: 0,
          pinned: true,
          availability: pin.state,
        },
      ];
    const ancestors = fileTreeAncestors(pin.path);
    const children =
      pin.entry.kind === 'directory'
        ? entries.filter(
            (entry) =>
              entry.path.startsWith(`${pin.path}/`) &&
              entry.path !== pin.entry.path,
          )
        : [];
    return visibleFileTreeRows(
      [pin.entry, ...children],
      new Set([...expanded, ...ancestors]),
    ).map(({ entry, depth }) => ({
      key: `pinned:${pin.path}:${entry.path}`,
      entry,
      depth: depth - ancestors.length,
      pinned: entry.path === pin.entry.path,
      availability: undefined,
    }));
  });
}
