import { useId } from 'react';
import {
  leaveDocuments,
  type DocumentLeaveGuard,
} from '../../shared/rules/document-leave';
import { useAtom, useAtomRef, useAtomMount } from '@effect/atom-react';
import { worktreeNavigatorState } from '@porcelain/client/projects';
import {
  sameRemoteConnection,
  type Remote,
} from '@porcelain/client/access/rules';
import {
  remoteConnectionState,
  selectionState,
} from '../../shared/application/store';

import { Atom, AtomRef } from 'effect/reactivity';
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

const leaveGuards = AtomRef.make<
  ReadonlyMap<string, { scope: string; guard: DocumentLeaveGuard }>
>(new Map());

const documentLeave = Atom.family(
  ({
    scope,
    guard,
    owner,
  }: {
    scope: string | undefined;
    guard: DocumentLeaveGuard | undefined;
    owner: string;
  }) =>
    Atom.make((get) => {
      if (!guard) return;
      leaveGuards.update((current) =>
        new Map(current).set(owner, { scope: scope ?? owner, guard }),
      );
      get.addFinalizer(() => {
        leaveGuards.update((current) => {
          if (current.get(owner)?.guard !== guard) return current;
          const next = new Map(current);
          next.delete(owner);
          return next;
        });
      });
    }),
);

export function useDocumentLeave(
  scope: string | undefined,
  guard: DocumentLeaveGuard | undefined,
) {
  const owner = useId();
  useAtomMount(documentLeave({ scope, guard, owner }));
}

export function requestDocumentLeave(leave: () => void, scope?: string) {
  leaveDocuments(
    [...leaveGuards.value.values()]
      .filter((entry) => scope === undefined || entry.scope === scope)
      .map((entry) => entry.guard),
    leave,
  );
}

export type OpenedReview = {
  reviewId: string;
  environmentId: string;
  workspace?: string | undefined;
};

export const openedReview = Atom.make<OpenedReview | undefined>(undefined).pipe(
  Atom.keepAlive,
);

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
