import type { ArrowDirection } from '@porcelain/client-runtime/terminal-keys'
import { Pressable, ScrollView, Text } from 'react-native'

import { ChromeGlyph, type ChromeIconName } from '@/components/chrome-glyph'
import { cn } from '@/lib/utils'

import { sendTerminalArrow, sendTerminalBytes, sendTerminalNewline } from './terminal-input'
import { takeArmedModifier, useTerminalInputStore } from './terminal-input-store'

const ARROWS: readonly { direction: ArrowDirection; label: string; glyph: ChromeIconName }[] = [
  { direction: 'left', glyph: 'chevronLeft', label: 'Left' },
  { direction: 'down', glyph: 'chevron', label: 'Down' },
  { direction: 'up', glyph: 'arrowUp', label: 'Up' },
  { direction: 'right', glyph: 'chevronRight', label: 'Right' },
]

/**
 * The keys a shell needs that a software keyboard does not have.
 *
 * It sits at the TOP of the pane, not the bottom, and that is not a style choice: the iOS
 * keyboard covers the bottom of the screen, so a bottom bar is hidden exactly when you are
 * typing — the one moment it exists for.
 *
 * Always on, with no setting to turn it off. Every client of this app is a touch device, so
 * there is no configuration to make: the bar is simply what a terminal looks like here.
 */
export function TerminalKeyBar({
  keyboardVisible,
  onToggleKeyboard,
  sessionId,
}: {
  keyboardVisible: boolean
  onToggleKeyboard: () => void
  sessionId: string
}): React.JSX.Element {
  const armed = useTerminalInputStore((state) => state.armed[sessionId])
  const toggle = useTerminalInputStore((state) => state.toggle)

  return (
    <ScrollView
      className="max-h-14 shrink-0 border-b border-border bg-card"
      contentContainerClassName="items-center gap-1 px-[16px] py-1.5"
      horizontal
      keyboardShouldPersistTaps="always"
      showsHorizontalScrollIndicator={false}
      testID="porcelain-terminal-key-bar"
    >
      <KeyButton
        label="Esc"
        testID="porcelain-terminal-key-esc"
        onPress={() => {
          takeArmedModifier(sessionId)
          sendTerminalBytes(sessionId, '\x1b')
        }}
      />
      <KeyButton
        label="Tab"
        testID="porcelain-terminal-key-tab"
        onPress={() => {
          takeArmedModifier(sessionId)
          sendTerminalBytes(sessionId, '\t')
        }}
      />
      {/* The one key a soft keyboard cannot type: its Return submits, and an agent prompt
          needs a newline to take a second line at all. */}
      <KeyButton
        accessibilityLabel="Newline without submitting"
        glyph="newline"
        testID="porcelain-terminal-key-newline"
        onPress={() => {
          sendTerminalNewline(sessionId)
        }}
      />
      <KeyButton
        accessibilityLabel="Ctrl — then press a key"
        active={armed === 'ctrl'}
        label="Ctrl"
        testID="porcelain-terminal-key-ctrl"
        onPress={() => {
          toggle(sessionId, 'ctrl')
        }}
      />
      <KeyButton
        accessibilityLabel="Alt — then press a key"
        active={armed === 'meta'}
        label="Alt"
        testID="porcelain-terminal-key-alt"
        onPress={() => {
          toggle(sessionId, 'meta')
        }}
      />
      {/* Interrupt is THE key you reach for on a phone; two taps through sticky Ctrl is one
          too many while a runaway process is printing. */}
      <KeyButton
        accessibilityLabel="Interrupt (Ctrl-C)"
        label="^C"
        testID="porcelain-terminal-key-ctrl-c"
        onPress={() => {
          takeArmedModifier(sessionId)
          sendTerminalBytes(sessionId, '\x03')
        }}
      />
      {ARROWS.map(({ direction, glyph, label }) => (
        <KeyButton
          key={direction}
          accessibilityLabel={label}
          glyph={glyph}
          testID={`porcelain-terminal-key-${direction}`}
          onPress={() => {
            sendTerminalArrow(sessionId, direction)
          }}
        />
      ))}
      <KeyButton
        accessibilityLabel={keyboardVisible ? 'Dismiss keyboard' : 'Show keyboard'}
        active={keyboardVisible}
        glyph="terminal"
        testID="porcelain-terminal-key-keyboard"
        onPress={onToggleKeyboard}
      />
    </ScrollView>
  )
}

function KeyButton({
  accessibilityLabel,
  active = false,
  glyph,
  label,
  onPress,
  testID,
}: {
  accessibilityLabel?: string
  active?: boolean
  glyph?: ChromeIconName
  label?: string
  onPress: () => void
  testID: string
}): React.JSX.Element {
  return (
    <Pressable
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityRole="button"
      accessibilityState={{ selected: active }}
      className={cn(
        'h-9 min-w-11 items-center justify-center rounded-lg border border-border px-2.5 active:bg-accent',
        active ? 'bg-accent' : 'bg-secondary',
      )}
      testID={testID}
      onPress={onPress}
    >
      {glyph === undefined ? (
        <Text className="font-mono text-xs font-medium text-secondary-foreground">{label}</Text>
      ) : (
        <ChromeGlyph name={glyph} size={15} tone="foreground" />
      )}
    </Pressable>
  )
}
