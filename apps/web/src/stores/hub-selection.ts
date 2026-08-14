import type { HubSelection } from '@porcelain/client-runtime/projects'
import { hubTargetOf } from '@porcelain/client-runtime/projects'
import { create } from 'zustand'
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
