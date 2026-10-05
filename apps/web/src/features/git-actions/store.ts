import { createStore } from 'zustand/vanilla';
import { useStore } from 'zustand';
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

function createCommitState() {
  return createStore<{
    done: ReadonlySet<string>;
    activeGroup: string | null;
    ownHead: string | null;
    busy: boolean;
    error: unknown;
    drafted: Drafts;
    editingFiles: boolean;
  }>(() => ({
    done: new Set(),
    activeGroup: null,
    ownHead: null,
    busy: false,
    error: null,
    drafted: { message: null, groups: null },
    editingFiles: false,
  }));
}

export function useCommitState(store: ReturnType<typeof createCommitState>) {
  return useStore(store);
}

const commitRuntimes = new WeakMap<
  object,
  {
    state: ReturnType<typeof createCommitState>;
    controllers: Set<AbortController>;
  }
>();

export function commitRuntime(owner: object) {
  const retained = commitRuntimes.get(owner);
  if (retained) return retained;
  const runtime = {
    state: createCommitState(),
    controllers: new Set<AbortController>(),
  };
  commitRuntimes.set(owner, runtime);
  return runtime;
}
