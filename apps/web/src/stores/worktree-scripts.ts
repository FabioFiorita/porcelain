import { create } from 'zustand'

/**
 * Which Project's Worktree lifecycle scripts are on screen.
 *
 * The scripts belong to a Project, and the place a human thinks about a Project is its row
 * in the sidebar tree — so the gesture is the tree's context menu while the dialog mounts
 * beside the tree. A store rather than local state because the two live in different
 * regions: `features/projects` must not reach into `features/actions` to raise it. Same
 * "one dialog, several openers" shape as `action-run-store`.
 */
export interface WorktreeScriptsTarget {
  projectId: string
  projectName: string
  /** The Environment the Project record belongs to — a Project id is Environment-local. */
  environmentId: string | null
  /** False only when the owning Environment has no writable live session. */
  editable: boolean
}

interface WorktreeScriptsState {
  target: WorktreeScriptsTarget | null
  open: (target: WorktreeScriptsTarget) => void
  close: () => void
}

export const useWorktreeScriptsStore = create<WorktreeScriptsState>((set) => ({
  target: null,
  open: (target: WorktreeScriptsTarget) => set({ target }),
  close: () => set({ target: null }),
}))
