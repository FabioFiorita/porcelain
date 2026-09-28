import { createStore } from 'zustand/vanilla';
import { useStore } from 'zustand';
import type { OperationStore } from '@/shared/query/operation-store';

export function useGitOperation(operations: OperationStore, key: string) {
  const snapshot = () => operations.get(key);
  return useStore({
    getState: snapshot,
    getInitialState: snapshot,
    subscribe: (listener) => {
      let previous = snapshot();
      return operations.subscribe(() => {
        const next = snapshot();
        listener(next, previous);
        previous = next;
      });
    },
  });
}

function createCommitState() {
  return createStore<{
    done: ReadonlySet<string>;
    activeGroup: string | null;
    ownHead: string | null;
    busy: boolean;
    error: unknown;
    draftToken: string | null;
    editingFiles: boolean;
  }>(() => ({
    done: new Set(),
    activeGroup: null,
    ownHead: null,
    busy: false,
    error: null,
    draftToken: null,
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
