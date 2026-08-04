import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useColorScheme } from 'react-native'

import {
  buildSourceTokensPatch,
  type ShikiHighlighter,
  tokenizeSourceDocument,
} from '@/features/changes/lib/highlight'
import { getHighlighter, shikiThemeName } from '@/features/changes/lib/shiki-highlighter'
import { pendingTokenRowIds } from '@/features/changes/lib/token-window'
import { RowCanvas } from '@/lib/row-canvas/row-canvas'
import type {
  RowCanvasRow,
  RowCanvasTheme,
  RowCanvasToken,
  RowCanvasTokensPatch,
  RowCanvasVisibleRange,
} from '@/lib/row-canvas/types'
import { buildSourceRows } from './source-rows'
import { sourceCanvasTheme } from './source-theme'

const FILL = { flex: 1 } as const

/**
 * Syntax-highlighted source on the row canvas. Whole-file Shiki tokenization keeps multiline
 * grammar correct; tokens only patch into the viewport band so a big file does not ship a
 * multi-megabyte JSON blob on first paint.
 */
export function SourceSurface({
  content,
  contentKey,
  path,
}: {
  content: string
  contentKey: string
  path: string
}): React.JSX.Element {
  const scheme = useColorScheme()
  return (
    <SourceCanvas
      content={content}
      contentKey={`${contentKey}:${scheme === 'dark' ? 'dark' : 'light'}`}
      path={path}
    />
  )
}

function SourceCanvas({
  content,
  contentKey,
  path,
}: {
  content: string
  contentKey: string
  path: string
}): React.JSX.Element {
  const scheme = useColorScheme()
  const appearance = scheme === 'dark' ? 'dark' : 'light'
  const themeName = shikiThemeName(appearance)
  const [tokensPatch, setTokensPatch] = useState<RowCanvasTokensPatch | undefined>(undefined)
  const [documentTokens, setDocumentTokens] = useState<ReadonlyMap<
    string,
    RowCanvasToken[]
  > | null>(null)
  const lastVisible = useRef<RowCanvasVisibleRange | null>(null)

  const rows = useMemo((): RowCanvasRow[] => buildSourceRows(content), [content])
  const theme = useMemo((): RowCanvasTheme => sourceCanvasTheme(appearance), [appearance])
  // Coverage tracks the current row array: a refetch under one contentKey still needs a fresh set.
  const tokenCoverage = useMemo(() => ({ rows, tokenized: new Set<string>() }), [rows])
  // Once the document is tokenised, every source line is eligible — blank lines simply have no
  // spans, but must still mark covered so the driver does not keep re-asking them.
  const tokenizableRows = useMemo((): ReadonlySet<string> | null => {
    if (documentTokens === null) return null
    return new Set(rows.map((row) => row.id))
  }, [documentTokens, rows])

  useEffect(() => {
    let cancelled = false
    setDocumentTokens(null)
    setTokensPatch(undefined)
    lastVisible.current = null

    const load = async (): Promise<void> => {
      try {
        const highlighter: ShikiHighlighter = await getHighlighter()
        if (cancelled) return
        setDocumentTokens(tokenizeSourceDocument(highlighter, content, path, themeName))
      } catch (error) {
        if (!cancelled) {
          console.warn('[source-surface] highlighter failed to load', error)
          setDocumentTokens(null)
        }
      }
    }
    load()

    return (): void => {
      cancelled = true
    }
  }, [content, path, themeName])

  const applyVisibleTokens = useCallback(
    (visible: { firstIndex: number; lastIndex: number }): void => {
      if (documentTokens === null || tokenizableRows === null) return
      const pending = pendingTokenRowIds({
        rows: tokenCoverage.rows,
        tokenizable: tokenizableRows,
        tokenized: tokenCoverage.tokenized,
        visible,
      })
      if (pending.length === 0) return

      const { covered, patch } = buildSourceTokensPatch(pending, documentTokens, contentKey)
      for (const rowId of covered) tokenCoverage.tokenized.add(rowId)
      if (Object.keys(patch.tokensByRowId).length > 0) setTokensPatch(patch)
    },
    [contentKey, documentTokens, tokenCoverage, tokenizableRows],
  )

  // Tokens often land after the first visible-range event; replay the last viewport so the
  // opening screen is coloured without waiting for a scroll.
  useEffect(() => {
    if (documentTokens === null || lastVisible.current === null) return
    applyVisibleTokens(lastVisible.current)
  }, [applyVisibleTokens, documentTokens])

  const handleVisibleRange = useCallback(
    (visible: RowCanvasVisibleRange): void => {
      lastVisible.current = visible
      applyVisibleTokens(visible)
    },
    [applyVisibleTokens],
  )

  return (
    <RowCanvas
      contentKey={contentKey}
      onVisibleRange={handleVisibleRange}
      rows={rows}
      style={FILL}
      theme={theme}
      tokensPatch={tokensPatch}
      tokensResetKey={contentKey}
    />
  )
}
