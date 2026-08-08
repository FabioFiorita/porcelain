import { useCallback } from 'react'
import { type NativeSyntheticEvent, StyleSheet, View } from 'react-native'
import {
  type PorcelainTerminalNativeProps,
  resolvePorcelainTerminalNativeView,
} from './porcelain-terminal-native'
import type { TerminalPalette } from './terminal-theme'

type TerminalInputEvent = {
  readonly data: string
}

type TerminalResizeEvent = {
  readonly cols: number
  readonly rows: number
}

type TerminalScrollEvent = {
  readonly lines: number
}

type TerminalKeyEvent = {
  readonly key: 'down' | 'left' | 'right' | 'up'
}

export type PorcelainTerminalSurfaceProps = {
  readonly appearanceScheme: 'dark' | 'light'
  readonly buffer: string
  readonly fontSize: number
  readonly palette: TerminalPalette
  readonly terminalKey: string
  readonly themeConfig: string
  /** Increment to explicitly focus the native input after the key bar is pressed. */
  readonly focusRequest: number
  /** Lets the key bar dismiss the native keyboard without unmounting the terminal. */
  readonly autoFocus: boolean
  readonly scrollLines: number
  readonly scrollRequest: number
  readonly onInput: (data: string) => void
  readonly onResize: (size: { readonly cols: number; readonly rows: number }) => void
  readonly onScroll: (lines: number) => void
  readonly onKey: (key: TerminalKeyEvent['key']) => void
}

/**
 * The only React Native entry point to the Ghostty canvas. It intentionally contains no daemon,
 * session, or screen concerns: callers keep ownership of the existing terminal transport.
 */
export function PorcelainTerminalSurface(
  props: PorcelainTerminalSurfaceProps,
): React.JSX.Element | null {
  const NativeSurface = resolvePorcelainTerminalNativeView()
  const handleInput = useCallback(
    (event: NativeSyntheticEvent<TerminalInputEvent>) => props.onInput(event.nativeEvent.data),
    [props.onInput],
  )
  const handleResize = useCallback(
    (event: NativeSyntheticEvent<TerminalResizeEvent>) =>
      props.onResize({ cols: event.nativeEvent.cols, rows: event.nativeEvent.rows }),
    [props.onResize],
  )
  const handleScroll = useCallback(
    (event: NativeSyntheticEvent<TerminalScrollEvent>) => props.onScroll(event.nativeEvent.lines),
    [props.onScroll],
  )
  const handleKey = useCallback(
    (event: NativeSyntheticEvent<TerminalKeyEvent>) => props.onKey(event.nativeEvent.key),
    [props.onKey],
  )

  if (NativeSurface === null) return null

  const nativeProps: PorcelainTerminalNativeProps = {
    appearanceScheme: props.appearanceScheme,
    autoFocus: props.autoFocus,
    backgroundColor: props.palette.background,
    fontSize: props.fontSize,
    foregroundColor: props.palette.foreground,
    focusRequest: props.focusRequest,
    initialBuffer: props.buffer,
    mutedForegroundColor: props.palette.foreground,
    onInput: handleInput,
    onResize: handleResize,
    onKey: handleKey,
    onScroll: handleScroll,
    scrollLines: props.scrollLines,
    scrollRequest: props.scrollRequest,
    terminalKey: props.terminalKey,
    themeConfig: props.themeConfig,
  }

  return (
    <View className="flex-1" testID="porcelain-terminal-native-surface">
      {/* nativewind-allow-style: Expo custom native hosts do not consume className without an
          explicit cssInterop registration. The wrapper was full-size while Ghostty stayed 0×0,
          so it never received onSizeChanged and could not create or draw a terminal. */}
      <NativeSurface {...nativeProps} style={StyleSheet.absoluteFill} />
    </View>
  )
}
