import { create } from 'zustand'

/**
 * The key bar's sticky Ctrl, shared with the xterm registry.
 *
 * A software keyboard has no Ctrl key, so the terminal key bar arms one instead: tap Ctrl,
 * then type a letter and the registry's key handler turns that keystroke into the control
 * byte (`controlByte` in lib/terminal-keys). Two components need the same flag — the bar
 * renders it as an "on" state, the registry consumes and clears it — so it's a store, not
 * component state.
 *
 * Scoped to ONE session id rather than a bare boolean: split view can show two terminals
 * at once, and arming Ctrl in one pane must not swallow the next keystroke in the other.
 */
interface TerminalInputState {
  /** Session whose next keystroke becomes a Ctrl chord, or null when nothing is armed. */
  pendingCtrlId: string | null
  /** Arm Ctrl for a session (tapping Ctrl again disarms it). */
  toggleCtrl: (id: string) => void
  /** Consume/cancel the armed Ctrl — called by the registry after the next keystroke. */
  clearCtrl: () => void
}

export const useTerminalInputStore = create<TerminalInputState>((set) => ({
  pendingCtrlId: null,
  toggleCtrl: (id) => set((s) => ({ pendingCtrlId: s.pendingCtrlId === id ? null : id })),
  clearCtrl: () => set({ pendingCtrlId: null }),
}))
