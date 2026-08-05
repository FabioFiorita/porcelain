import type { TerminalModifier } from '@porcelain/client-runtime/terminal-keys'
import { create } from 'zustand'

/**
 * The key bar's sticky modifiers: tap Ctrl (or Alt), then a key, and the modifier applies to
 * that one keystroke — the only route to ^C, ^R and the ESC-prefixed chords agent TUIs bind,
 * because a software keyboard has neither key.
 *
 * Keyed BY SESSION, not global: the tablet can show one terminal while another is a tap away,
 * and an armed modifier must not cross-fire into the wrong shell.
 */
type TerminalInputState = {
  /** Session id → the modifier armed for its next keystroke. */
  armed: Record<string, TerminalModifier | undefined>
  /** Tapping the armed modifier again disarms it, the way a real sticky key behaves. */
  toggle: (id: string, modifier: TerminalModifier) => void
  clear: (id: string) => void
}

export const useTerminalInputStore = create<TerminalInputState>()((set) => ({
  armed: {},
  clear: (id: string) => {
    set((state) => ({ armed: { ...state.armed, [id]: undefined } }))
  },
  toggle: (id: string, modifier: TerminalModifier) => {
    set((state) => ({
      armed: { ...state.armed, [id]: state.armed[id] === modifier ? undefined : modifier },
    }))
  },
}))

/** Read and consume the armed modifier — every keystroke disarms, chord or not. */
export function takeArmedModifier(id: string): TerminalModifier | undefined {
  const armed = useTerminalInputStore.getState().armed[id]
  if (armed !== undefined) useTerminalInputStore.getState().clear(id)
  return armed
}
