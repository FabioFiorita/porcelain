import { ImpactFeedbackStyle, impactAsync } from 'expo-haptics'
import { useCallback, useEffect, useImperativeHandle, useMemo, useRef } from 'react'
import { type StyleProp, useColorScheme, type ViewStyle } from 'react-native'

import { type EntryItem, type EntryTarget, entryCanvasRows } from '@/components/entry-rows'
import { RowCanvas } from '@/lib/row-canvas/row-canvas'
import type { RowCanvasHandle, RowCanvasRowEvent } from '@/lib/row-canvas/types'
import { listCanvasTheme } from '@/theme/list-canvas'

const FILL = { flex: 1 } as const

export type EntryCanvasProps = {
  items: readonly EntryItem[]
  /**
   * One list, one key: changing it resets the canvas's scroll. Keep it stable while the same list
   * is on screen — expanding a folder must not throw the reader back to the top.
   */
  contentKey: string
  /** Reserve the disclosure column — a tree does, a flat list does not. */
  disclosure?: boolean
  /** `key` of the row to show as selected. */
  selectedKey?: string | null
  /**
   * Scroll this row into view once it exists. A reveal from outside the list — a pinned folder, a
   * search hit — asks for a row the tree has to open its way down to first, so the scroll waits
   * for the row rather than being dropped when it is not there yet.
   */
  revealKey?: string | null
  onPress: (item: EntryTarget) => void
  onLongPress?: (item: EntryTarget) => void
  onRefresh?: () => void
  refreshing?: boolean
  canvasRef?: React.Ref<RowCanvasHandle>
  style?: StyleProp<ViewStyle>
}

/**
 * A list of paths on the diff's canvas. Rows are drawn, not mounted, so a repository the size of
 * this one costs one view — and the file the list opens is rendered by the same surface in the
 * same font, which is the point.
 */
export function EntryCanvas({
  canvasRef,
  contentKey,
  disclosure = false,
  items,
  onLongPress,
  onPress,
  onRefresh,
  refreshing,
  revealKey,
  selectedKey,
  style,
}: EntryCanvasProps): React.JSX.Element {
  const scheme = useColorScheme() === 'dark' ? 'dark' : 'light'
  const theme = useMemo(() => listCanvasTheme(scheme), [scheme])
  const rows = useMemo(
    () => entryCanvasRows(items, { disclosure, scheme }),
    [disclosure, items, scheme],
  )
  const byId = useMemo(
    (): Map<string, EntryItem> => new Map(items.map((item) => [item.key, item])),
    [items],
  )
  // Read through a ref so a fresh row array never rebuilds the native callbacks.
  const entriesRef = useRef(byId)
  entriesRef.current = byId

  const state = useMemo(
    () => ({
      selectedRowIds: selectedKey === null || selectedKey === undefined ? [] : [selectedKey],
    }),
    [selectedKey],
  )

  // The canvas handle is this component's own, so a reveal works without every caller wiring one;
  // a caller that passes `canvasRef` still gets the same handle.
  const handleRef = useRef<RowCanvasHandle>(null)
  useImperativeHandle(
    canvasRef,
    (): RowCanvasHandle => ({
      scrollToRow: async (rowId: string, animated = true): Promise<void> => {
        await handleRef.current?.scrollToRow(rowId, animated)
      },
      scrollToTop: async (animated = true): Promise<void> => {
        await handleRef.current?.scrollToTop(animated)
      },
    }),
    [],
  )
  const revealedRef = useRef<string | null>(null)
  useEffect((): void => {
    if (revealKey === null || revealKey === undefined) {
      revealedRef.current = null
      return
    }
    if (revealedRef.current === revealKey || !byId.has(revealKey)) return
    revealedRef.current = revealKey
    handleRef.current?.scrollToRow(revealKey, true).catch(() => {
      // The row can go before the scroll lands — a listing that refreshed under the reveal.
    })
  }, [byId, revealKey])

  const handlePress = useCallback(
    (event: RowCanvasRowEvent): void => {
      const item = entriesRef.current.get(event.rowId)
      if (item === undefined || item.kind === 'section') return
      onPress(item)
    },
    [onPress],
  )

  const handleLongPress = useCallback(
    (event: RowCanvasRowEvent): void => {
      if (onLongPress === undefined) return
      const item = entriesRef.current.get(event.rowId)
      if (item === undefined || item.kind === 'section') return
      impactAsync(ImpactFeedbackStyle.Light).catch(() => {
        // Haptics are a courtesy; a device without them still gets the menu.
      })
      onLongPress(item)
    },
    [onLongPress],
  )

  return (
    <RowCanvas
      canvasRef={handleRef}
      contentKey={contentKey}
      onRefresh={onRefresh}
      onRowLongPress={handleLongPress}
      onRowPress={handlePress}
      refreshing={refreshing}
      rows={rows}
      state={state}
      style={style ?? FILL}
      theme={theme}
    />
  )
}
