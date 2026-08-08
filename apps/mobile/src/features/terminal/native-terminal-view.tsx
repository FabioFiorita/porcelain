import { applyTerminalTouchScroll } from '@porcelain/client-runtime/terminal-touch-scroll'
import { useCallback, useEffect, useState, useSyncExternalStore } from 'react'
import { Keyboard, Platform, View } from 'react-native'

import { ErrorNote } from '@/components/surface-chrome'
import { usePreferencesStore } from '@/features/settings/preferences-store'
import { useResolvedColorScheme } from '@/features/settings/theme-provider'
import { PorcelainTerminalSurface } from './porcelain-terminal-surface'
import { TerminalCommandComposer } from './terminal-command-composer'
import {
  ensureTerminal,
  fitTerminal,
  getTerminal,
  scrollTerminal,
  subscribeTerminal,
  terminalFailure,
  terminalNativeBuffer,
} from './terminal-engine'
import { sendTerminalArrow, sendTerminalBytes } from './terminal-input'
import { TerminalKeyBar } from './terminal-key-bar'
import { terminalFontSize } from './terminal-metrics'
import { nativeThemeConfig, TERMINAL_PALETTES } from './terminal-theme'
import { useKeyboardInset } from './use-keyboard-inset'

/**
 * The production path: Ghostty owns terminal state and pixels; JS owns the PTY transport.
 *
 * The headless parser is still started beside it — see the effect below — but it is a protocol
 * companion here, not the renderer. The xterm sibling in `xterm-terminal-view.tsx` is the
 * compatibility path for an installed binary that predates the native canvas; the two are split
 * by backend exactly like `native-terminal-buffer.ts` and `xterm-host.ts` below them.
 */
export function NativeTerminalView({ sessionId }: { sessionId: string }): React.JSX.Element {
  const scheme = useResolvedColorScheme()
  const palette = TERMINAL_PALETTES[scheme === 'dark' ? 'dark' : 'light']
  const textSize = usePreferencesStore((state) => state.terminalTextSize)
  const fontSize = terminalFontSize(textSize)
  const keyboardInset = useKeyboardInset()
  // This tracks ownership of the keyboard, not whether Android/iOS currently shows an IME.
  // The visible composer is a separate native editing surface: treating its focus as terminal
  // focus makes the hidden Ghostty field immediately steal first responder back on every draft
  // update, so paste, selection and dictation never reliably reach the composer.
  const [terminalKeyboardActive, setTerminalKeyboardActive] = useState(false)
  const [focusRequest, setFocusRequest] = useState(0)
  const [scrollRequest, setScrollRequest] = useState({ lines: 0, revision: 0 })

  useEffect(() => {
    // Keep the headless parser alive as the protocol companion: it provides current terminal
    // modes for the shared key encoder and handles write-only OSC 52 clipboard requests. It is
    // not the renderer on this path.
    ensureTerminal(sessionId)
  }, [sessionId])

  const buffer = useSyncExternalStore(
    useCallback((listener: () => void) => subscribeTerminal(sessionId, listener), [sessionId]),
    useCallback(() => terminalNativeBuffer(sessionId), [sessionId]),
  )

  const failure = terminalFailure(sessionId)
  const focusTerminal = (): void => {
    setTerminalKeyboardActive(true)
    setFocusRequest((value) => value + 1)
  }
  const dismissTerminalKeyboard = (): void => {
    Keyboard.dismiss()
    setTerminalKeyboardActive(false)
  }

  return (
    <View
      className="flex-1"
      /* nativewind-allow-style: terminal palettes are PTY rendering state, and current
         edge-to-edge Android can overlay the IME even with adjustResize in the manifest. */
      style={{
        backgroundColor: palette.background,
        paddingBottom: Platform.OS === 'android' ? keyboardInset : 0,
      }}
      testID="porcelain-terminal-view"
    >
      <TerminalKeyBar
        keyboardVisible={terminalKeyboardActive}
        sessionId={sessionId}
        onToggleKeyboard={() => {
          if (terminalKeyboardActive) dismissTerminalKeyboard()
          else focusTerminal()
        }}
      />
      <View className="min-h-0 flex-1 overflow-hidden">
        <PorcelainTerminalSurface
          appearanceScheme={scheme === 'dark' ? 'dark' : 'light'}
          autoFocus={terminalKeyboardActive}
          buffer={buffer}
          focusRequest={focusRequest}
          fontSize={fontSize}
          palette={palette}
          scrollLines={scrollRequest.lines}
          scrollRequest={scrollRequest.revision}
          terminalKey={sessionId}
          themeConfig={nativeThemeConfig(palette)}
          onInput={(data) => {
            // This includes Ghostty's terminal replies as well as direct/native keyboard
            // input, so it must bypass the JS hidden-field modifier/paste transformation.
            sendTerminalBytes(sessionId, data)
          }}
          onKey={(key) => sendTerminalArrow(sessionId, key)}
          onResize={({ cols, rows }) => {
            fitTerminal(sessionId, cols, rows)
          }}
          onScroll={(lines) => {
            const live = getTerminal(sessionId)
            if (live === undefined) return
            applyTerminalTouchScroll(
              {
                bufferType: live.buffer.active.type === 'alternate' ? 'alternate' : 'normal',
                cols: live.cols,
                input: (data: string) => sendTerminalBytes(sessionId, data),
                mouseTrackingMode: live.modes.mouseTrackingMode,
                rows: live.rows,
                scrollLines: (normalLines: number) => {
                  // Keep the compatibility parser aligned, then move the Android Ghostty canvas.
                  scrollTerminal(sessionId, normalLines)
                  setScrollRequest((value) => ({
                    lines: normalLines,
                    revision: value.revision + 1,
                  }))
                },
              },
              lines,
            )
          }}
        />
        {failure === undefined ? null : (
          <View className="absolute left-3 right-3 top-3">
            <ErrorNote
              message={`Terminal compatibility features are unavailable: ${failure}. Ghostty is still connected to the shell.`}
              testID="porcelain-terminal-engine-error"
            />
          </View>
        )}
      </View>
      <View
        /* nativewind-allow-style: iOS keyboards overlay the app; this docks the composer above it. */
        style={{
          transform: [{ translateY: Platform.OS === 'ios' ? -keyboardInset : 0 }],
        }}
      >
        <TerminalCommandComposer
          sessionId={sessionId}
          onBlur={() => setTerminalKeyboardActive(false)}
          onFocus={() => setTerminalKeyboardActive(false)}
        />
      </View>
    </View>
  )
}
