import type { Action } from '@backend/actions-store'
import { create } from 'zustand'

/**
 * Compose-intent store for running a local-targeted action that still needs the
 * This-device folder map. The file finder (and any other opener) can request a run;
 * the Terminal Actions section mounts the path dialog and completes the run — same
 * pattern as `file-prompt` / `card-draft` (one dialog, multiple openers).
 */
interface ActionRunState {
  pendingLocal: Action | null
  requestLocalRun: (action: Action) => void
  clearPendingLocal: () => void
}

export const useActionRunStore = create<ActionRunState>((set) => ({
  pendingLocal: null,
  requestLocalRun: (action: Action) => set({ pendingLocal: action }),
  clearPendingLocal: () => set({ pendingLocal: null }),
}))
