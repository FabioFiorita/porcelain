import { useAtom, useAtomSet, useAtomValue } from '@effect/atom-react';
import { Atom } from 'effect/reactivity';

type NavigationState = {
  readonly expanded: ReadonlySet<string>;
  readonly requested: readonly string[];
  readonly query: string;
  readonly showHidden: boolean;
  readonly selectedPath: string | undefined;
};

const initialNavigation = (): NavigationState => ({
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

export const fileReadingLine = Atom.family(
  (_: { workspace: string; path: string }) => Atom.make(1).pipe(Atom.keepAlive),
);

export const fileReadingStart = Atom.family(
  ({ workspace, path }: { workspace: string; path: string; source: string }) =>
    Atom.make((get) => get.once(fileReadingLine({ workspace, path }))).pipe(
      Atom.setIdleTTL(0),
    ),
);

export function useFileReadingLine(
  workspace: string,
  path: string,
  source: string,
) {
  const line = fileReadingLine({ workspace, path });
  const setLine = useAtomSet(line);
  return {
    initialLine: useAtomValue(fileReadingStart({ workspace, path, source })),
    onReadingLine: setLine,
  };
}
