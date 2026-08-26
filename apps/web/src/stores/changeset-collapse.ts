import { create } from 'zustand'

interface ChangesetCollapseState {
  collapsedByScope: Readonly<Record<string, readonly string[]>>
  toggle: (scope: string, path: string) => void
  collapse: (scope: string, path: string) => void
  clear: () => void
}

function updateScope(
  current: Readonly<Record<string, readonly string[]>>,
  scope: string,
  path: string,
  collapsed: boolean,
): Readonly<Record<string, readonly string[]>> {
  const paths = new Set(current[scope] ?? [])
  if (collapsed) paths.add(path)
  else paths.delete(path)
  return { ...current, [scope]: [...paths] }
}

/** Session-scoped file-card state, keyed by worktree and changeset scope. */
export const useChangesetCollapseStore = create<ChangesetCollapseState>((set) => ({
  collapsedByScope: {},
  toggle: (scope, path) =>
    set((state) => {
      const collapsed = !(state.collapsedByScope[scope] ?? []).includes(path)
      return {
        collapsedByScope: updateScope(state.collapsedByScope, scope, path, collapsed),
      }
    }),
  collapse: (scope, path) =>
    set((state) => ({
      collapsedByScope: updateScope(state.collapsedByScope, scope, path, true),
    })),
  clear: () => set({ collapsedByScope: {} }),
}))
