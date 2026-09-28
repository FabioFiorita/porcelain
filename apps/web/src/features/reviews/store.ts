import { useStore } from 'zustand';
import { persist, type PersistStorage } from 'zustand/middleware';
import { createStore, type StoreApi } from 'zustand/vanilla';
import { type Pane, parseTabLayout } from './rules/tab-strip';

function savedJson<S>(read: (saved: unknown) => S): PersistStorage<S> {
  return {
    getItem(name) {
      let raw: string | null;
      try {
        raw = localStorage.getItem(name);
      } catch {
        return null;
      }
      if (raw == null) return null;
      let saved: unknown;
      try {
        saved = JSON.parse(raw);
      } catch {
        saved = null;
      }
      return { state: read(saved) };
    },
    setItem(name, value) {
      try {
        localStorage.setItem(name, JSON.stringify(value.state));
      } catch {
        return;
      }
    },
    removeItem(name) {
      try {
        localStorage.removeItem(name);
      } catch {
        return;
      }
    },
  };
}

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
        storage: savedJson<SavedTabLayout>((saved) => ({
          panes: parseTabLayout(saved),
          saved: true,
        })),
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
