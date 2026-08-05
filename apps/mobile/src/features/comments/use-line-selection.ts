import { useCallback, useState } from 'react'

import type { LineSelection } from './line-range'

export type LineSelectionControls = {
  selection: LineSelection | null
  /** Long-press: anchor a new selection on this line, dropping any previous one. */
  start: (path: string, line: number) => void
  /** Tap while selecting: move the far end of the range to this line. */
  extend: (path: string, line: number) => void
  clear: () => void
}

/**
 * Line-range selection for any surface that renders numbered lines — a diff, a source file,
 * the continuous read.
 *
 * The web viewer anchors a comment by dragging a text selection, which a touch surface has
 * no equivalent for — a drag over a virtualized list is a scroll, and React Native has no
 * selection across separate `Text` nodes. So the range is built the way touch does it:
 * long-press anchors, taps extend, and a bar confirms.
 *
 * A tap on a line in another file re-anchors there rather than being ignored — a selection
 * that silently refuses input reads as broken, and a comment cannot span two files anyway.
 */
export function useLineSelection(): LineSelectionControls {
  const [selection, setSelection] = useState<LineSelection | null>(null)

  const start = useCallback((path: string, line: number): void => {
    setSelection({ anchor: line, focus: line, path })
  }, [])

  const extend = useCallback((path: string, line: number): void => {
    setSelection((current) =>
      current === null || current.path !== path
        ? { anchor: line, focus: line, path }
        : { ...current, focus: line },
    )
  }, [])

  const clear = useCallback((): void => {
    setSelection(null)
  }, [])

  return { clear, extend, selection, start }
}
