import { useState } from 'react';
import { useAtom } from '@effect/atom-react';
import { Atom } from 'effect/reactivity';

type NavigationState = {
  readonly expanded: ReadonlySet<string>;
  readonly requested: readonly string[];
  readonly query: string;
  readonly showHidden: boolean;
  readonly pinnedOpen: boolean;
  readonly allOpen: boolean;
};

const initialNavigation = (): NavigationState => ({
  expanded: new Set(),
  requested: [''],
  query: '',
  showHidden: false,
  pinnedOpen: true,
  allOpen: true,
});

const navigation = Atom.family((_: string) =>
  Atom.make(initialNavigation()).pipe(Atom.keepAlive),
);

export function useFileNavigation(workspace: string, retained: boolean) {
  const [local] = useState(() => Atom.make(initialNavigation()));
  const [state, set] = useAtom(retained ? navigation(workspace) : local);
  return {
    ...state,
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
    setPinnedOpen: (update: (current: boolean) => boolean) =>
      set((current) => ({
        ...current,
        pinnedOpen: update(current.pinnedOpen),
      })),
    setAllOpen: (update: (current: boolean) => boolean) =>
      set((current) => ({ ...current, allOpen: update(current.allOpen) })),
  };
}
