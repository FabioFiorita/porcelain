import { useAtom, useAtomRef } from '@effect/atom-react';
import { worktreeNavigatorState } from '@porcelain/client/projects';
import {
  sameRemoteConnection,
  type Remote,
} from '@porcelain/client/access/rules';
import {
  remoteConnectionState,
  selectionState,
} from '../../shared/application/store';

import { Atom } from 'effect/reactivity';
import type { WorktreeSection } from './rules/worktree-section';

export function useProjectSelection() {
  return useAtomRef(selectionState);
}

export function useWorktreeNavigator() {
  const [state, setState] = useAtom(worktreeNavigatorState);
  return {
    ...state,
    setExpanded: (key: string, expanded: boolean) =>
      setState((current) => ({
        ...current,
        expanded: { ...current.expanded, [key]: expanded },
      })),
    setQuery: (query: string) => setState((current) => ({ ...current, query })),
    setFilter: (filter: typeof state.filter) =>
      setState((current) => ({ ...current, filter })),
  };
}

export function useProjectConnection(remote: Remote | undefined) {
  return useAtomRef(remoteConnectionState).find(
    (entry) => remote && sameRemoteConnection(entry.remote, remote),
  )?.connection;
}

export function useComputerConnection(environmentId: string | undefined) {
  return useAtomRef(remoteConnectionState).find(
    (entry) => entry.remote.environmentId === environmentId,
  )?.connection;
}

export type WorktreeDetails = {
  title: string;
  project: string;
  computer: string;
  environment: string;
  projectId: string;
  worktreeId: string;
  opening: WorktreeSection;
  reviewId?: string | undefined;
  number?: string | undefined;
};

export const worktreeSection = Atom.family((_workspace: string) =>
  Atom.make<WorktreeSection | undefined>(undefined).pipe(Atom.keepAlive),
);

export const openedWorktree = Atom.make<WorktreeDetails | undefined>(
  undefined,
).pipe(Atom.keepAlive);

export const worktreeListHidden = Atom.make(false).pipe(Atom.keepAlive);
