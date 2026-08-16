import { useMemo, useState } from 'react'
import {
  describeRange,
  isLineInRange,
  type LineRange,
  type LineSelection,
  MAX_ANCHOR_TEXT,
  rangeForPath,
  rangeOf,
} from './line-range'

export type { LineRange, LineSelection }
export { describeRange, isLineInRange, MAX_ANCHOR_TEXT, rangeForPath, rangeOf }

/** Historical migration shape retained only so generic line-selection callers can compile. */
export type CommentAnchor = {
  path: string
  startLine?: number
  endLine?: number
  anchorText?: string
}

export type LineSelectionControls = {
  selection: LineSelection | null
  start: (path: string, line: number) => void
  extend: (path: string, line: number) => void
  clear: () => void
}

export function useLineSelection(): LineSelectionControls {
  const [selection, setSelection] = useState<LineSelection | null>(null)
  return useMemo(
    () => ({
      selection,
      start: (path, line) => setSelection({ path, anchor: line, focus: line }),
      extend: (path, line) =>
        setSelection((current) =>
          current?.path === path
            ? { ...current, focus: line }
            : { path, anchor: line, focus: line },
        ),
      clear: () => setSelection(null),
    }),
    [selection],
  )
}

export function useReviewComments(_active: boolean): readonly never[] {
  return []
}

export function useCommentIndex(
  _comments: readonly unknown[],
  _path: string,
): { byLine: Map<number, never[]>; fileLevel: readonly never[] } {
  return { byLine: new Map(), fileLevel: [] }
}

export function useCommentedLinesByPath(_comments: readonly unknown[]): Map<string, Set<number>> {
  return new Map()
}

export function CommentComposer(_props: Record<string, unknown>): null {
  return null
}

export function SelectionBar(_props: Record<string, unknown>): null {
  return null
}
