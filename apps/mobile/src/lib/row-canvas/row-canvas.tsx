import { requireNativeView } from 'expo'
import type { Ref, RefObject } from 'react'
import { createElement, useEffect, useImperativeHandle, useMemo, useRef } from 'react'
import type { StyleProp, ViewStyle } from 'react-native'

import type {
  RowCanvasHandle,
  RowCanvasRow,
  RowCanvasRowEvent,
  RowCanvasState,
  RowCanvasTheme,
  RowCanvasTokensPatch,
  RowCanvasVisibleRange,
} from '@/lib/row-canvas/types'

const MODULE_NAME = 'PorcelainRowCanvas'
/** Fabric attaches the React ref a frame or two before Expo registers the native tag the view
 *  functions address, so the first `setRowsJson` has to be allowed to miss and retry. */
const REGISTRATION_RETRY_FRAMES = 60

type NativeEvent<Payload> = { nativeEvent: Payload }

type NativeCommands = {
  setRowsJson: (rowsJson: string) => Promise<void>
  setTokensPatchJson: (tokensPatchJson: string) => Promise<void>
  scrollToRow: (rowId: string, animated: boolean) => Promise<void>
  scrollToTop: (animated: boolean) => Promise<void>
}

type NativeProps = {
  contentKey: string
  tokensResetKey: string
  themeJson: string
  stateJson: string
  refreshEnabled: boolean
  refreshing: boolean
  style?: StyleProp<ViewStyle>
  ref?: Ref<NativeCommands>
  onVisibleRange?: (event: NativeEvent<RowCanvasVisibleRange>) => void
  onRowPress?: (event: NativeEvent<RowCanvasRowEvent>) => void
  onRowLongPress?: (event: NativeEvent<RowCanvasRowEvent>) => void
  onRefresh?: () => void
}

export type RowCanvasProps = {
  rows: readonly RowCanvasRow[]
  theme: RowCanvasTheme
  state?: RowCanvasState
  /** Changing it resets scroll, rows and tokens: one document, one key. */
  contentKey: string
  tokensResetKey?: string
  tokensPatch?: RowCanvasTokensPatch
  refreshing?: boolean
  style?: StyleProp<ViewStyle>
  canvasRef?: Ref<RowCanvasHandle>
  onVisibleRange?: (range: RowCanvasVisibleRange) => void
  onRowPress?: (event: RowCanvasRowEvent) => void
  onRowLongPress?: (event: RowCanvasRowEvent) => void
  onRefresh?: () => void
}

const NativeView = requireNativeView<NativeProps>(MODULE_NAME)

function usePayload(
  ref: RefObject<NativeCommands | null>,
  command: 'setRowsJson' | 'setTokensPatchJson',
  payload: string | undefined,
): void {
  useEffect(() => {
    if (payload === undefined) return

    let cancelled = false
    let frame = 0
    let attempts = 0

    function dispatch(): void {
      if (cancelled) return
      const view = ref.current
      if (view === null) {
        if (attempts >= REGISTRATION_RETRY_FRAMES) return
        attempts += 1
        frame = requestAnimationFrame(dispatch)
        return
      }
      view[command](payload ?? '').catch((error: unknown) => {
        if (cancelled || attempts >= REGISTRATION_RETRY_FRAMES) return
        attempts += 1
        if (attempts === 1) console.warn(`[row-canvas] ${command} retrying`, error)
        frame = requestAnimationFrame(dispatch)
      })
    }

    frame = requestAnimationFrame(dispatch)
    return (): void => {
      cancelled = true
      cancelAnimationFrame(frame)
    }
  }, [command, payload, ref])
}

/**
 * The one native row surface. Rows and token patches travel as JSON through view functions
 * rather than props: Expo compares prop strings on the main thread, so a large document diffed
 * on every render costs a frame before a single row is drawn.
 */
export function RowCanvas({
  canvasRef,
  contentKey,
  onRefresh,
  onRowLongPress,
  onRowPress,
  onVisibleRange,
  refreshing = false,
  rows,
  state,
  style,
  theme,
  tokensPatch,
  tokensResetKey = contentKey,
}: RowCanvasProps): React.JSX.Element {
  const nativeRef = useRef<NativeCommands>(null)
  const rowsJson = useMemo((): string => JSON.stringify(rows), [rows])
  const themeJson = useMemo((): string => JSON.stringify(theme), [theme])
  const stateJson = useMemo((): string => JSON.stringify(state ?? {}), [state])
  const tokensPatchJson = useMemo(
    (): string | undefined => (tokensPatch === undefined ? undefined : JSON.stringify(tokensPatch)),
    [tokensPatch],
  )

  usePayload(nativeRef, 'setRowsJson', rowsJson)
  usePayload(nativeRef, 'setTokensPatchJson', tokensPatchJson)

  useImperativeHandle(
    canvasRef,
    (): RowCanvasHandle => ({
      scrollToRow: async (rowId: string, animated = true): Promise<void> => {
        await nativeRef.current?.scrollToRow(rowId, animated)
      },
      scrollToTop: async (animated = true): Promise<void> => {
        await nativeRef.current?.scrollToTop(animated)
      },
    }),
    [],
  )

  return createElement(NativeView, {
    contentKey,
    onRefresh,
    onRowLongPress: (event: NativeEvent<RowCanvasRowEvent>): void =>
      onRowLongPress?.(event.nativeEvent),
    onRowPress: (event: NativeEvent<RowCanvasRowEvent>): void => onRowPress?.(event.nativeEvent),
    onVisibleRange: (event: NativeEvent<RowCanvasVisibleRange>): void =>
      onVisibleRange?.(event.nativeEvent),
    ref: nativeRef,
    refreshEnabled: onRefresh !== undefined,
    refreshing,
    stateJson,
    style,
    themeJson,
    tokensResetKey,
  })
}
