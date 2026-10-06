import { Atom, AtomRef } from 'effect/reactivity';
import { useAtomRef } from '@effect/atom-react';
import type { Context } from 'effect';
import type { OperationStore } from '@porcelain/client/git-actions';
import type { Drafts } from '@porcelain/client/git-actions/rules';

export function useGitOperation(
  operations: Context.Service.Shape<typeof OperationStore>,
  key: string,
) {
  const selected = operations.state.map(
    (state) => state.operations.get(key) ?? null,
  );
  return useAtomRef(selected);
}

type CommitState = {
  done: ReadonlySet<string>;
  activeGroup: string | null;
  ownHead: string | null;
  busy: boolean;
  error: unknown;
  drafted: Drafts;
  editingFiles: boolean;
};
export const commitState = Atom.family((_owner: object) =>
  AtomRef.make<CommitState>({
    done: new Set(),
    activeGroup: null,
    ownHead: null,
    busy: false,
    error: null,
    drafted: { message: null, groups: null },
    editingFiles: false,
  }),
);
export const commitDraftControllers = Atom.family(
  (_owner: object) => new Set<AbortController>(),
);
