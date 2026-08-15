import type { HubSelection, HubTarget } from '@porcelain/client-runtime/projects'
import { hubTargetOf } from '@porcelain/client-runtime/projects'
import { create } from 'zustand'
import { useShallow } from 'zustand/react/shallow'
import { useProjectSelectionStore } from './project-selection'

interface HubSelectionStore {
  selection: HubSelection
  selectHome: () => void
  selectProject: (input: { environmentId: string; projectId: string }) => void
  selectWorktree: (input: {
    environmentId: string
    projectId: string
    worktreeId: string
    path: string
    name: string
  }) => void
}

export const useHubSelectionStore = create<HubSelectionStore>((set) => ({
  selection: { kind: 'home' },
  selectHome: () => {
    set({ selection: { kind: 'home' } })
    useProjectSelectionStore.getState().selectProject(null)
  },
  selectProject: (input) => {
    set({
      selection: {
        kind: 'project',
        environmentId: input.environmentId,
        projectId: input.projectId,
      },
    })
    useProjectSelectionStore.getState().selectProject(null)
  },
  selectWorktree: (input) => {
    set({
      selection: {
        kind: 'worktree',
        environmentId: input.environmentId,
        projectId: input.projectId,
        worktreeId: input.worktreeId,
        path: input.path,
      },
    })
    useProjectSelectionStore.getState().selectProject({ path: input.path, name: input.name })
  },
}))

export function currentHubTarget() {
  return hubTargetOf(useHubSelectionStore.getState().selection)
}

/**
 * Reactive counterpart to currentHubTarget — null unless a Worktree is selected.
 * `useShallow`: hubTargetOf builds a fresh object every call, and useSyncExternalStore
 * (what zustand's hook is built on) requires a snapshot that's referentially stable
 * when nothing changed, or React loops re-rendering forever.
 */
export function useHubTarget(): HubTarget | null {
  return useHubSelectionStore(useShallow((s) => hubTargetOf(s.selection)))
}
