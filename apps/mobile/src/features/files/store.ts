import { useAtom, useAtomSet, useAtomValue } from '@effect/atom-react';
import { Atom } from 'effect/reactivity';
import type { ListDirectoryResponse } from '@porcelain/contracts/files';
import {
  reconcileFileNavigation,
  type FileNavigationState,
} from './rules/file-navigation';

const initialNavigation = (): FileNavigationState => ({
  expanded: new Set(),
  requested: [''],
  query: '',
  showHidden: false,
  selectedPath: undefined,
});

export const fileNavigation = Atom.family((_: string) =>
  Atom.make(initialNavigation()).pipe(Atom.keepAlive),
);

export const fileNavigationOffset = Atom.family((_: string) =>
  Atom.make(0).pipe(Atom.keepAlive),
);

const initialFileNavigationOffset = Atom.family((workspace: string) =>
  Atom.make((get) => get.once(fileNavigationOffset(workspace))).pipe(
    Atom.setIdleTTL(0),
  ),
);

export function useFileNavigation(workspace: string) {
  const [state, set] = useAtom(fileNavigation(workspace));
  const offset = fileNavigationOffset(workspace);
  const setScrollOffset = useAtomSet(offset);
  return {
    ...state,
    scrollOffset: useAtomValue(initialFileNavigationOffset(workspace)),
    setScrollOffset,
    reconcileDirectories: (directories: readonly ListDirectoryResponse[]) =>
      set((current) => reconcileFileNavigation(current, directories)),
    setSelectedPath: (selectedPath: string) =>
      set((current) => ({ ...current, selectedPath })),
    setExpanded: (
      update:
        | ReadonlySet<string>
        | ((current: ReadonlySet<string>) => ReadonlySet<string>),
    ) =>
      set((current) => ({
        ...current,
        expanded:
          typeof update === 'function' ? update(current.expanded) : update,
      })),
    setRequested: (
      update:
        | readonly string[]
        | ((current: readonly string[]) => readonly string[]),
    ) =>
      set((current) => ({
        ...current,
        requested:
          typeof update === 'function' ? update(current.requested) : update,
      })),
    setQuery: (query: string) => set((current) => ({ ...current, query })),
    setShowHidden: (update: (current: boolean) => boolean) =>
      set((current) => ({
        ...current,
        showHidden: update(current.showHidden),
      })),
  };
}
