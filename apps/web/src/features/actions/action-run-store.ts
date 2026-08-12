import type { ActionView } from '@porcelain/contracts/actions'
import { create } from 'zustand'

/**
 * Compose-intent store for running a local-targeted action that still needs the
 * This-device folder map. The file finder (and any other opener) can request a run;
 * the Terminal Actions section mounts the path dialog and completes the run — same
 * pattern as `file-prompt` / `card-draft` (one dialog, multiple openers).
 */
interface ActionRunState {
  pendingLocal: ActionView | null
  requestLocalRun: (action: ActionView) => void
  clearPendingLocal: () => void
}

export const useActionRunStore = create<ActionRunState>((set) => ({
  pendingLocal: null,
  requestLocalRun: (action: ActionView) => set({ pendingLocal: action }),
  clearPendingLocal: () => set({ pendingLocal: null }),
}))
