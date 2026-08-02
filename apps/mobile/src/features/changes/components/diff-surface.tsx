import { useCallback, useMemo, useState } from 'react'
import { useColorScheme } from 'react-native'

import {
  diffCanvasRows,
  type TokenizableLine,
  tokenizableLines,
} from '@/features/changes/lib/canvas-rows'
import { diffCanvasTheme } from '@/features/changes/lib/canvas-theme'
import type { DiffRow } from '@/features/changes/lib/diff-rows'
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
  onOpenFile,
  rows,
  tokenizer,
}: DiffSurfaceProps): React.JSX.Element {
  const scheme = useColorScheme()
  const [tokensPatch, setTokensPatch] = useState<RowCanvasTokensPatch | undefined>(undefined)
  const canvasRows = useMemo((): RowCanvasRow[] => diffCanvasRows(rows), [rows])
  // The covered set belongs to this row array, not to the document: rows can be refetched under
  // one `contentKey`, and a positional row id then names a different line.
  const { lines, tokenized } = useMemo(
    (): { lines: Map<string, TokenizableLine>; tokenized: Set<string> } => ({
      lines: tokenizableLines(rows, defaultPath),
      tokenized: new Set<string>(),
    }),
    [rows, defaultPath],
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
        rows: canvasRows,
        tokenizable: lines,
        tokenized,
        visible,
      })
      if (pending.length === 0) return

      const { covered, patch } = buildTokensPatch(pending, lines, tokenizer, contentKey)
      for (const rowId of covered) tokenized.add(rowId)
      if (Object.keys(patch.tokensByRowId).length > 0) setTokensPatch(patch)
    },
    [canvasRows, contentKey, lines, tokenized, tokenizer],
  )

  const handleRowPress = useCallback(
    (event: RowCanvasRowEvent): void => {
      const row = byId.get(event.rowId)
      if (row === undefined || onOpenFile === undefined) return
      if (row.kind === 'file') onOpenFile(row.path)
      if (row.kind === 'notice' && row.path !== undefined) onOpenFile(row.path)
    },
    [byId, onOpenFile],
  )

  return (
    <RowCanvas
      contentKey={contentKey}
      onRowPress={handleRowPress}
      onVisibleRange={handleVisibleRange}
      rows={canvasRows}
      style={FILL}
      theme={theme}
      tokensPatch={tokensPatch}
      tokensResetKey={contentKey}
    />
  )
}
