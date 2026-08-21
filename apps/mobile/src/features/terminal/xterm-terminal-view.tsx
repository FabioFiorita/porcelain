import {
  applyTerminalTouchScroll,
  applyTouchScrollDelta,
} from '@porcelain/client-runtime/terminal-touch-scroll'
import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from 'react'
import { Keyboard, Platform, Text, TextInput, View } from 'react-native'
import { Gesture, GestureDetector } from 'react-native-gesture-handler'

import { ErrorNote } from '@/components/surface-chrome'
import { usePreferencesStore } from '@/features/settings/preferences-store'
import { useResolvedColorScheme } from '@/features/settings/theme-provider'
import { useBottomChrome } from '@/features/shell/window-chrome'
import { readViewport, type TerminalRun } from './terminal-cells'
import { TerminalCommandComposer } from './terminal-command-composer'
import {
  ensureTerminal,
  fitTerminal,
  getTerminal,
  scrollTerminal,
  subscribeTerminal,
  terminalFailure,
  terminalRevision,
} from './terminal-engine'
import { FIELD_SENTINEL, terminalFieldEdit } from './terminal-field'
import { sendTerminalBytes, sendTerminalText } from './terminal-input'
import { TerminalKeyBar } from './terminal-key-bar'
import {
  terminalColumnLeft,
  terminalCoveredInset,
  terminalFontSize,
  terminalGrid,
  terminalLineHeight,
  terminalRowTop,
} from './terminal-metrics'
import { TERMINAL_PALETTES } from './terminal-theme'
import { useKeyboardInset } from './use-keyboard-inset'

/**
 * Wait for the pane to settle before telling the PTY, exactly as the web client does. Every fit
 * that changes the grid is a SIGWINCH, and a rotation, a keyboard animation or a split drag
 * fires layout continuously — shells like p10k and agent CLIs reprint their whole prompt for
 * each one, stacking copies up the scrollback.
 */
const FIT_DEBOUNCE_MS = 100

/**
 * The terminal's face: GeistMono Nerd Font Mono, embedded by the `expo-font` plugin.
 *
 * NOT the `font-mono` token, which resolves to Menlo — absent on Android, and lacking the
 * Private Use Area glyphs that starship, powerline themes and agent prompts emit, which is how
 * a terminal ends up painting a row of tofu exactly where the prompt is. A patched face carries
 * those glyphs in the SAME font as the text, so there is no second face to fall back to and
 * nothing that can disagree about a cell's width.
 *
 * Bold is a real face rather than a synthesized weight: faux bold smears a monospace glyph
 * wider than its cell, and in a grid that shears every column after it. So the weight picks the
 * family, and `fontWeight` is deliberately never set.
 *
 * The two platforms name an embedded font differently — iOS by PostScript name, Android by the
 * file's own name.
 */
const MONO = Platform.select({
  android: { bold: 'GeistMonoNerdFontMono-Bold', regular: 'GeistMonoNerdFontMono-Regular' },
  default: { bold: 'GeistMonoNFM-Bold', regular: 'GeistMonoNFM-Regular' },
  ios: { bold: 'GeistMonoNFM-Bold', regular: 'GeistMonoNFM-Regular' },
})
/** Wide enough that per-glyph rounding averages out when divided back down. */
const WIDTH_SAMPLE = 'M'.repeat(40)

/**
 * Older installed binaries render with the former pure-JS xterm compatibility surface.
 *
 * The emulator is NOT in this component — it lives in the registry, because the viewer only
 * mounts the session on screen and component state would destroy the shell (and its scrollback)
 * on every switch. All this does is size the grid to the pane, paint the current viewport, and
 * route touches and keystrokes.
 *
 * Keystrokes go to the daemon, never into the emulator: the emulator's buffer is a picture of
 * what the PTY actually echoed, which is what makes it trustworthy while an agent is writing.
 */
export function XtermTerminalView({ sessionId }: { sessionId: string }): React.JSX.Element {
  const bottomInset = useBottomChrome()
  const scheme = useResolvedColorScheme()
  const palette = TERMINAL_PALETTES[scheme === 'dark' ? 'dark' : 'light']
  const textSize = usePreferencesStore((state) => state.terminalTextSize)
  const fontSize = terminalFontSize(textSize)
  const lineHeight = terminalLineHeight(textSize)
  const inputRef = useRef<TextInput>(null)
  const [charWidth, setCharWidth] = useState(0)
  const [pane, setPane] = useState({ height: 0, width: 0 })
  const [keyboardVisible, setKeyboardVisible] = useState(false)
  // What the hidden field currently holds. Mirrored in a ref because the change handler needs
  // the value it is diffing against, and two keystrokes can land before a render.
  const [field, setField] = useState(FIELD_SENTINEL)
  const fieldRef = useRef(FIELD_SENTINEL)
  const keyboardInset = useKeyboardInset()
  const residual = useRef(0)
  const lastPan = useRef(0)
  /** The session whose first fit has already landed — see the fit effect. */
  const fitted = useRef<string | null>(null)

  useEffect(() => {
    ensureTerminal(sessionId)
  }, [sessionId])

  // The subscription is what re-renders this component; the revision itself is never read,
  // because the emulator's buffer — not a copy of it — is the state being painted.
  useSyncExternalStore(
    useCallback((listener: () => void) => subscribeTerminal(sessionId, listener), [sessionId]),
    useCallback(() => terminalRevision(sessionId), [sessionId]),
  )

  const gridHeight = Math.max(
    0,
    pane.height -
      terminalCoveredInset({
        bottomInset,
        keyboardInset,
        keyboardOverlays: Platform.OS === 'ios',
      }),
  )

  useEffect(() => {
    // `pane` is what onLayout reported, which is the BORDER box — `terminalGrid` takes the
    // pane's own padding off before it divides, or the PTY is told about one more row than the
    // pane can paint and a TUI's input box is written onto it, outside the clip.
    const grid = terminalGrid({ height: gridHeight, width: pane.width }, charWidth, lineHeight)
    if (grid === null) return
    // The FIRST fit for a session lands immediately: attaching replays the scrollback as soon
    // as the view mounts, and xterm never re-wraps lines it has already printed — a debounced
    // first fit would wrap the whole replay at the size the PTY happened to start at.
    if (fitted.current !== sessionId) {
      fitted.current = sessionId
      fitTerminal(sessionId, grid.cols, grid.rows)
      return
    }
    const timer = setTimeout(() => {
      fitTerminal(sessionId, grid.cols, grid.rows)
    }, FIT_DEBOUNCE_MS)
    return () => {
      clearTimeout(timer)
    }
  }, [charWidth, gridHeight, lineHeight, pane.width, sessionId])

  // Deliberately not memoized: the subscription above decides when this component renders at
  // all, and re-reading the viewport is cheaper than the JSX it feeds.
  const viewport = readViewport(getTerminal(sessionId), palette)
  const failure = terminalFailure(sessionId)

  const pan = Gesture.Pan()
    .runOnJS(true)
    .onBegin(() => {
      residual.current = 0
      lastPan.current = 0
    })
    .onUpdate((event) => {
      const dy = event.translationY - lastPan.current
      lastPan.current = event.translationY
      const applied = applyTouchScrollDelta(residual.current, dy, lineHeight)
      residual.current = applied.residual
      if (applied.lines === 0) return
      const live = getTerminal(sessionId)
      if (live === undefined) return
      // The alternate buffer has no scrollback of its own, so a full-screen app has to be
      // asked to scroll in its own language — see the shared rules for why never arrows.
      applyTerminalTouchScroll(
        {
          bufferType: live.buffer.active.type === 'alternate' ? 'alternate' : 'normal',
          cols: live.cols,
          input: (data: string) => {
            sendTerminalBytes(sessionId, data)
          },
          mouseTrackingMode: live.modes.mouseTrackingMode,
          rows: live.rows,
          scrollLines: (lines: number) => {
            scrollTerminal(sessionId, lines)
          },
        },
        applied.lines,
      )
    })

  // A tap raises the keyboard; a pan does not. Race lets the pan win as soon as the finger
  // travels, so scrolling back through a build log never opens the keyboard over it.
  const tap = Gesture.Tap()
    .runOnJS(true)
    .onEnd(() => {
      inputRef.current?.focus()
    })

  /** The keyboard edits a hidden field; the diff of that field is the input. */
  const handleChange = (next: string): void => {
    // Read the mode live: bracketed paste is turned on and off by whatever is running in the
    // PTY right now, so a paste into an agent's prompt is wrapped while the same paste at a
    // bare shell is not.
    const bracketedPaste = getTerminal(sessionId)?.modes.bracketedPasteMode ?? false
    const edit = terminalFieldEdit(fieldRef.current, next, { bracketedPaste })
    if (edit.bytes !== '') sendTerminalText(sessionId, edit.bytes)
    fieldRef.current = edit.value
    setField(edit.value)
  }

  return (
    <View
      className="flex-1"
      /* nativewind-allow-style: the pane fills with terminal state; edge-to-edge Android can
         overlay the IME despite adjustResize, so the compatibility renderer reserves it too. */
      style={{
        backgroundColor: palette.background,
        paddingBottom: Platform.OS === 'android' ? keyboardInset : 0,
      }}
      testID="porcelain-terminal-view"
    >
      <TerminalKeyBar
        keyboardVisible={keyboardVisible}
        sessionId={sessionId}
        onToggleKeyboard={() => {
          if (keyboardVisible) {
            Keyboard.dismiss()
            inputRef.current?.blur()
          } else inputRef.current?.focus()
        }}
      />

      <GestureDetector gesture={Gesture.Race(pan, tap)}>
        <View
          /* Keep in step with `TERMINAL_PANE_PADDING_X` / `_Y` — the fit and the cursor both
             subtract those, and a class that disagrees shears the grid. */
          className="min-h-0 flex-1 overflow-hidden px-2 py-1"
          onLayout={(event) => {
            const { height, width } = event.nativeEvent.layout
            setPane({ height, width })
          }}
        >
          {/* Measured rather than assumed: cell width decides cols, and a wrong cols is a
              shell that wraps its prompt in the wrong place. */}
          <Text
            accessibilityElementsHidden
            importantForAccessibility="no-hide-descendants"
            /* nativewind-allow-style: an off-screen ruler for the monospace advance. */
            style={{
              fontFamily: MONO.regular,
              fontSize,
              left: -9999,
              position: 'absolute',
            }}
            onLayout={(event) => {
              setCharWidth(event.nativeEvent.layout.width / WIDTH_SAMPLE.length)
            }}
          >
            {WIDTH_SAMPLE}
          </Text>

          {failure === undefined ? null : (
            <View className="p-3">
              <ErrorNote
                message={`The terminal engine could not start: ${failure}. The shell is still running on the daemon — reopen this session to try again.`}
                testID="porcelain-terminal-engine-error"
              />
            </View>
          )}

          {viewport.rows.map((runs, row) => (
            <TerminalRow
              // The grid is positional: row N is row N until the viewport scrolls, and the
              // content is the state, so the index IS the identity here.
              // biome-ignore lint/suspicious/noArrayIndexKey: fixed grid position, not a list
              key={row}
              foreground={palette.foreground}
              fontSize={fontSize}
              lineHeight={lineHeight}
              runs={runs}
            />
          ))}

          {viewport.cursor === null || charWidth <= 0 ? null : (
            <View
              /* nativewind-allow-style: the cursor is placed on the measured cell grid, with
                 the same constants the fit above subtracted — the two must never disagree. */
              style={{
                backgroundColor: palette.cursor,
                height: lineHeight,
                left: terminalColumnLeft(viewport.cursor.column, charWidth),
                opacity: keyboardVisible ? 0.75 : 0.35,
                position: 'absolute',
                top: terminalRowTop(viewport.cursor.row, lineHeight),
                width: Math.max(2, charWidth),
              }}
              testID="porcelain-terminal-cursor"
            />
          )}

          <TextInput
            ref={inputRef}
            autoCapitalize="none"
            autoComplete="off"
            autoCorrect={false}
            caretHidden
            keyboardAppearance={scheme === 'dark' ? 'dark' : 'light'}
            multiline
            spellCheck={false}
            /* nativewind-allow-style: an invisible capture field, not a laid-out control. */
            style={{ height: 1, left: 0, opacity: 0, position: 'absolute', top: 0, width: 1 }}
            submitBehavior="newline"
            testID="porcelain-terminal-input"
            value={field}
            onBlur={() => {
              setKeyboardVisible(false)
            }}
            onChangeText={handleChange}
            onFocus={() => {
              setKeyboardVisible(true)
            }}
          />
        </View>
      </GestureDetector>
      <View
        /* nativewind-allow-style: iOS keyboards overlay the app; this visually docks the
           composer above it while its original layout space keeps terminal rows out of it. */
        style={{ transform: [{ translateY: Platform.OS === 'ios' ? -keyboardInset : 0 }] }}
      >
        <TerminalCommandComposer
          sessionId={sessionId}
          onBlur={() => {
            setKeyboardVisible(false)
          }}
          onFocus={() => {
            setKeyboardVisible(true)
          }}
        />
      </View>
    </View>
  )
}

function TerminalRow({
  foreground,
  fontSize,
  lineHeight,
  runs,
}: {
  foreground: string
  fontSize: number
  lineHeight: number
  runs: TerminalRun[]
}): React.JSX.Element {
  return (
    <Text
      numberOfLines={1}
      /* nativewind-allow-style: the terminal grid is measured, not a typographic scale. */
      style={{
        color: foreground,
        fontFamily: MONO.regular,
        fontSize,
        height: lineHeight,
        lineHeight,
      }}
    >
      {runs.map((run, index) => (
        <Text
          // Runs are positional within a row that is itself replaced on every repaint.
          // biome-ignore lint/suspicious/noArrayIndexKey: positional run in a rebuilt row
          key={index}
          /* nativewind-allow-style: colours come from the shell's own escape sequences. */
          /* The weight picks the FAMILY; `fontWeight` would synthesize a second, wider bold on
             top of the real one and break the grid. */
          style={{
            backgroundColor: run.style.background,
            color: run.style.color,
            fontFamily: run.style.bold ? MONO.bold : MONO.regular,
            fontStyle: run.style.italic ? 'italic' : 'normal',
            textDecorationLine: run.style.underline ? 'underline' : 'none',
          }}
        >
          {run.text}
        </Text>
      ))}
    </Text>
  )
}
