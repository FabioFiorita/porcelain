import { useStore } from 'zustand';
import { persist } from 'zustand/middleware';
import { createStore, type StoreApi } from 'zustand/vanilla';
import { type CodeFolds, parseCodeFolds, withFolds } from './rules/code-folds';
import { savedJson } from '@/shared/lib/saved-json';
import { type Pane, parseTabLayout } from './rules/tab-strip';

type TabLayoutState = {
  panes: Pane[] | null;
  saved: boolean;
  save: (panes: Pane[]) => void;
};
type SavedTabLayout = { panes: Pane[] | null; saved?: boolean };

const tabLayouts = new Map<string, StoreApi<TabLayoutState>>();

function tabLayout(worktreeId: string) {
  const retained = tabLayouts.get(worktreeId);
  if (retained) return retained;
  const store = createStore<TabLayoutState>()(
    persist<TabLayoutState, [], [], SavedTabLayout>(
      (set) => ({
        panes: null,
        saved: false,
        save: (panes) => set({ panes, saved: true }),
      }),
      {
        name: `porcelain.tabs.${worktreeId}`,
        storage: savedJson<SavedTabLayout>(
          () => localStorage,
          (saved) => ({ panes: parseTabLayout(saved), saved: true }),
        ),
        partialize: (state) => ({ panes: state.panes }),
      },
    ),
  );
  tabLayouts.set(worktreeId, store);
  return store;
}

export function useTabLayoutStore(worktreeId: string) {
  const store = tabLayout(worktreeId);
  const panes = useStore(store, (state) => state.panes);
  const saved = useStore(store, (state) => state.saved);
  return { panes, saved, save: store.getState().save };
}

type CodeFoldsState = CodeFolds & {
  setCollapsed: (ids: readonly string[], collapsed: boolean) => void;
};

const codeFolds = new Map<string, StoreApi<CodeFoldsState>>();

function foldsOf(worktreeId: string, entry: string) {
  const name = `porcelain.folds.${worktreeId}.${entry}`;
  const retained = codeFolds.get(name);
  if (retained) return retained;
  const store = createStore<CodeFoldsState>()(
    persist<CodeFoldsState, [], [], CodeFolds>(
      (set, get) => ({
        folded: [],
        expanded: [],
        setCollapsed: (ids, collapsed) => set(withFolds(get(), ids, collapsed)),
      }),
      {
        name,
        storage: savedJson(() => localStorage, parseCodeFolds),
        partialize: ({ folded, expanded }) => ({ folded, expanded }),
      },
    ),
  );
  codeFolds.set(name, store);
  return store;
}

export function useCodeFolds(worktreeId: string, entry: string) {
  const store = foldsOf(worktreeId, entry);
  const folded = useStore(store, (state) => state.folded);
  const expanded = useStore(store, (state) => state.expanded);
  return {
    folds: { folded, expanded },
    setCollapsed: store.getState().setCollapsed,
  };
}
