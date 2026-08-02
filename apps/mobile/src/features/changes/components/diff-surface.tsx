import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useColorScheme } from 'react-native'

import {
  diffCanvasRanges,
  diffCanvasRows,
  tokenizableLines,
} from '@/features/changes/lib/canvas-rows'
import { diffCanvasTheme } from '@/features/changes/lib/canvas-theme'
import { collapsedRowIds, type DiffRow } from '@/features/changes/lib/diff-rows'
import { buildTokensPatch, type RowTokenizer } from '@/features/changes/lib/highlight'
import { pendingTokenRowIds } from '@/features/changes/lib/token-window'
import { RowCanvas } from '@/lib/row-canvas/row-canvas'
import type {
  RowCanvasRow,
  RowCanvasRowEvent,
  RowCanvasTheme,
  RowCanvasTokensPatch,
} from '@/lib/row-canvas/types'

const FILL = { flex: 1 } as const

export type DiffSurfaceProps = {
  rows: readonly DiffRow[]
  /** One document, one key: changing it resets the canvas's scroll and tokens. */
  contentKey: string
  /** The file a single-file document is showing, for language detection. */
  defaultPath?: string
  /** Show per-file collapse controls; enabled only for the whole-change reader. */
  collapsible?: boolean
  /** Reviewed paths from the existing Actions flow; newly reviewed files collapse inline. */
  reviewedPaths?: readonly string[]
  onOpenFile?: (path: string) => void
  tokenizer?: RowTokenizer
}

/** The diff renderer backed by the native row canvas in the current iOS client. */
export function DiffSurface(props: DiffSurfaceProps): React.JSX.Element {
  const scheme = useColorScheme()
  // Keyed by the document and the appearance: a new document gets a new canvas rather than an
  // effect that has to remember to clear the tokens the previous one accumulated, and an
  // appearance flip gets the same treatment — otherwise already-tokenized rows would keep the
  // previous theme's colours until they scroll back into view.
  return (
    <DiffCanvas key={`${props.contentKey}:${scheme === 'dark' ? 'dark' : 'light'}`} {...props} />
  )
}

function DiffCanvas({
  contentKey,
  defaultPath,
  collapsible = false,
  reviewedPaths,
  onOpenFile,
  rows,
  tokenizer,
}: DiffSurfaceProps): React.JSX.Element {
  const scheme = useColorScheme()
  const [tokensPatch, setTokensPatch] = useState<RowCanvasTokensPatch | undefined>(undefined)
  const [collapsedPaths, setCollapsedPaths] = useState<ReadonlySet<string>>(new Set())
  const reviewedPathsRef = useRef<ReadonlySet<string>>(new Set())
  useEffect(() => {
    if (!collapsible || reviewedPaths === undefined) return
    const previous = reviewedPathsRef.current
    const current = new Set(reviewedPaths)
    reviewedPathsRef.current = current
    const newlyReviewed = reviewedPaths.filter((path) => !previous.has(path))
    if (newlyReviewed.length === 0) return
    setCollapsedPaths((collapsed) => {
      const next = new Set(collapsed)
      for (const path of newlyReviewed) next.add(path)
      return next.size === collapsed.size ? collapsed : next
    })
  }, [collapsible, reviewedPaths])
  const ranges = useMemo(() => diffCanvasRanges(rows), [rows])
  const canvasRows = useMemo(
    (): RowCanvasRow[] => diffCanvasRows(rows, { collapsible, collapsedPaths, ranges }),
    [collapsedPaths, collapsible, ranges, rows],
  )
  const state = useMemo(
    () => ({
      collapsedRowIds: collapsible ? collapsedRowIds(rows, collapsedPaths) : [],
    }),
    [collapsedPaths, collapsible, rows],
  )
  // The covered set belongs to this row array, not to the document: rows can be refetched under
  // one `contentKey`, and a positional row id then names a different line.
  const lines = useMemo(() => tokenizableLines(rows, defaultPath), [rows, defaultPath])
  // Native rows clear their attributed/token caches whenever the collapse state changes. Keep a
  // fresh coverage set with that payload so re-expanding a file requests syntax again.
  const tokenCoverage = useMemo(
    () => ({ rows: canvasRows, tokenized: new Set<string>() }),
    [canvasRows],
  )
  const theme = useMemo(
    (): RowCanvasTheme => diffCanvasTheme(scheme === 'dark' ? 'dark' : 'light'),
    [scheme],
  )
  const byId = useMemo(
    (): Map<string, DiffRow> => new Map(rows.map((row) => [row.key, row])),
    [rows],
  )

  const handleVisibleRange = useCallback(
    (visible: { firstIndex: number; lastIndex: number }): void => {
      if (tokenizer === undefined) return
      const pending = pendingTokenRowIds({
        rows: tokenCoverage.rows,
        tokenizable: lines,
        tokenized: tokenCoverage.tokenized,
        visible,
      })
      if (pending.length === 0) return

      const { covered, patch } = buildTokensPatch(pending, lines, tokenizer, contentKey)
      for (const rowId of covered) tokenCoverage.tokenized.add(rowId)
      if (Object.keys(patch.tokensByRowId).length > 0) setTokensPatch(patch)
    },
    [contentKey, lines, tokenCoverage, tokenizer],
  )

  const handleRowPress = useCallback(
    (event: RowCanvasRowEvent): void => {
      const row = byId.get(event.rowId)
      if (row === undefined) return
      if (collapsible && event.inGutter && row.kind === 'file') {
        setCollapsedPaths((current) => {
          const next = new Set(current)
          if (next.has(row.path)) next.delete(row.path)
          else next.add(row.path)
          return next
        })
        return
      }
      if (onOpenFile === undefined) return
      if (row.kind === 'file') onOpenFile(row.path)
      if (row.kind === 'notice' && row.path !== undefined) onOpenFile(row.path)
    },
    [byId, collapsible, onOpenFile],
  )

  return (
    <RowCanvas
      contentKey={contentKey}
      onRowPress={handleRowPress}
      onVisibleRange={handleVisibleRange}
      rows={canvasRows}
      state={state}
      style={FILL}
      theme={theme}
      tokensPatch={tokensPatch}
      tokensResetKey={contentKey}
    />
  )
}
