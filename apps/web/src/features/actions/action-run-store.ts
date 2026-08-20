import type { ActionView } from '@porcelain/contracts/actions'
import { create } from 'zustand'

/**
 * Compose-intent store for the saved-Actions roster: whether its header popover is
 * showing, and a local-targeted run that still needs the This-device folder map.
 *
 * `ActionsGroup` mounts only inside that popover, and it owns the trust and path dialogs —
 * so an opener that needs one (the file finder recovering a run, ⌘⇧A) has to be able to
 * put the roster on screen. Same pattern as `file-prompt` / `card-draft`: one dialog,
 * several openers.
 */
interface ActionRunState {
  menuOpen: boolean
  setMenuOpen: (open: boolean) => void
  pendingLocal: ActionView | null
  requestLocalRun: (action: ActionView) => void
  clearPendingLocal: () => void
}

export const useActionRunStore = create<ActionRunState>((set) => ({
  menuOpen: false,
  setMenuOpen: (open: boolean) => set({ menuOpen: open }),
  pendingLocal: null,
  requestLocalRun: (action: ActionView) => set({ pendingLocal: action }),
  clearPendingLocal: () => set({ pendingLocal: null }),
}))
