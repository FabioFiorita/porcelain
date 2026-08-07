import type { ArrowDirection } from '@porcelain/client-runtime/terminal-keys'
import { Alert, Pressable, ScrollView, Text } from 'react-native'

import { ChromeGlyph, type ChromeIconName } from '@/components/chrome-glyph'
import { getImage, hasImage } from '@/lib/clipboard'
import { pasteImageToTerminal } from '@/lib/daemon/terminal'
import { cn } from '@/lib/utils'

import { sendTerminalArrow, sendTerminalBytes, sendTerminalNewline } from './terminal-input'
import { takeArmedModifier, useTerminalInputStore } from './terminal-input-store'

/**
 * Copy a screenshot, tap this, and the agent in the shell can see it — the PTY is always
 * on the daemon's machine, never this device, so the daemon does the actual attaching;
 * this only hands it the bytes and reports failure. No toast primitive exists on mobile
 * (only `Alert.alert`, used the same way for the delete-environment confirmation), so
 * every failure here is a modal rather than a transient banner.
 */
async function handlePasteImage(sessionId: string): Promise<void> {
  if (!(await hasImage())) {
    Alert.alert('No image on clipboard', 'Copy a screenshot or photo first, then try again.')
    return
  }
  const image = await getImage()
  if (image === null) {
    Alert.alert('Could not read the clipboard image', 'Try copying it again.')
    return
  }
  const outcome = await pasteImageToTerminal(sessionId, image.mime, image.base64).catch(() => ({
    result: 'write-failed' as const,
  }))
  if (outcome.result === 'ok') return
  const message: Record<'no-session' | 'too-large' | 'write-failed', string> = {
    'no-session': 'This terminal is no longer available.',
    'too-large': 'That image is too large to paste.',
    'write-failed': 'The daemon could not save the image. Try again.',
  }
  Alert.alert('Could not attach the image', message[outcome.result])
}

const ARROWS: readonly { direction: ArrowDirection; label: string; glyph: ChromeIconName }[] = [
  { direction: 'left', glyph: 'chevronLeft', label: 'Left' },
  { direction: 'down', glyph: 'chevron', label: 'Down' },
  { direction: 'up', glyph: 'chevronUp', label: 'Up' },
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
      contentContainerClassName="items-center gap-1 px-4 py-1.5"
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
      <KeyButton
        accessibilityLabel="Paste image from clipboard"
        glyph="image"
        testID="porcelain-terminal-key-paste-image"
        onPress={() => {
          handlePasteImage(sessionId)
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
