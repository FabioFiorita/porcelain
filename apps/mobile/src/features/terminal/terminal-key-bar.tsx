import { useRef } from 'react'
import { Pressable, ScrollView, Text, View } from 'react-native'

import type { AppearanceScheme } from '@/theme/colors'
import { terminalColors } from '@/theme/terminal-colors'

import type { ArrowDirection, TerminalModifier } from './terminal-keys'

export type SpecialKey = 'escape' | 'tab' | 'ctrl-c' | ArrowDirection

/**
 * Keys a soft keyboard hides behind two taps but a shell needs constantly. Ordered by reach:
 * the pipe and tilde a command line is built from come before the readline conveniences.
 */
const LITERAL_KEYS = ['|', '~', '/', '-', '_', '&', '*', '$'] as const

/**
 * The bar docks to the top of the keyboard rather than the top of the screen. Every key on it is
 * a correction to a keystroke you just typed — Esc, ^C, a word-back — so it belongs under the
 * thumb that typed it, not a phone's length away.
 */
export function TerminalKeyBar({
  armed,
  composerOpen,
  keyboardVisible,
  onKeyboardToggle,
  onLiteralKey,
  onRestoreFocus,
  onSpecialKey,
  onToggleComposer,
  onToggleModifier,
  scheme,
  terminalFocused,
}: {
  armed: TerminalModifier | null
  composerOpen: boolean
  keyboardVisible: boolean
  onKeyboardToggle: () => void
  onLiteralKey: (key: string) => void
  onRestoreFocus: () => void
  onSpecialKey: (key: SpecialKey) => void
  onToggleComposer: () => void
  onToggleModifier: (modifier: TerminalModifier) => void
  scheme: AppearanceScheme
  terminalFocused: () => boolean
}): React.JSX.Element {
  const colors = terminalColors(scheme)
  const focusedAtPressRef = useRef(false)

  function pressIn(): void {
    focusedAtPressRef.current = terminalFocused()
  }

  /** A bar tap steals first responder; give it back so the next soft keypress still lands. */
  function restore(): void {
    if (focusedAtPressRef.current) onRestoreFocus()
    focusedAtPressRef.current = false
  }

  function special(key: SpecialKey): void {
    onSpecialKey(key)
    restore()
  }

  function literal(key: string): void {
    onLiteralKey(key)
    restore()
  }

  function modifier(value: TerminalModifier): void {
    onToggleModifier(value)
    restore()
  }

  return (
    <View
      style={{ backgroundColor: colors.surface, borderTopColor: colors.border, borderTopWidth: 1 }}
    >
      <View style={{ alignItems: 'center', flexDirection: 'row' }}>
        <ScrollView
          contentContainerStyle={{ alignItems: 'center', gap: 8, paddingHorizontal: 10 }}
          horizontal
          keyboardShouldPersistTaps="always"
          showsHorizontalScrollIndicator={false}
          style={{ flex: 1, paddingVertical: 8 }}
        >
          <KeyButton
            colors={colors}
            label="esc"
            onPress={(): void => special('escape')}
            onPressIn={pressIn}
          />
          <KeyButton
            colors={colors}
            label="tab"
            onPress={(): void => special('tab')}
            onPressIn={pressIn}
          />
          <KeyButton
            active={armed === 'ctrl'}
            colors={colors}
            label="ctrl"
            onPress={(): void => modifier('ctrl')}
            onPressIn={pressIn}
          />
          <KeyButton
            active={armed === 'meta'}
            colors={colors}
            label="alt"
            onPress={(): void => modifier('meta')}
            onPressIn={pressIn}
          />
          <KeyButton
            colors={colors}
            label="^C"
            onPress={(): void => special('ctrl-c')}
            onPressIn={pressIn}
          />
          <KeyButton
            colors={colors}
            label="←"
            onPress={(): void => special('left')}
            onPressIn={pressIn}
          />
          <KeyButton
            colors={colors}
            label="↓"
            onPress={(): void => special('down')}
            onPressIn={pressIn}
          />
          <KeyButton
            colors={colors}
            label="↑"
            onPress={(): void => special('up')}
            onPressIn={pressIn}
          />
          <KeyButton
            colors={colors}
            label="→"
            onPress={(): void => special('right')}
            onPressIn={pressIn}
          />
          {LITERAL_KEYS.map((key) => (
            <KeyButton
              key={key}
              colors={colors}
              label={key}
              onPress={(): void => literal(key)}
              onPressIn={pressIn}
            />
          ))}
        </ScrollView>
        {/* Outside the scroller: the two controls you must always be able to reach. */}
        <View
          style={{
            borderLeftColor: colors.border,
            borderLeftWidth: 1,
            flexDirection: 'row',
            gap: 8,
            paddingHorizontal: 10,
            paddingVertical: 8,
          }}
        >
          <KeyButton
            accessibilityLabel={composerOpen ? 'Close composer' : 'Compose a line'}
            active={composerOpen}
            colors={colors}
            label="⌨︎+"
            onPress={onToggleComposer}
            onPressIn={(): void => {
              focusedAtPressRef.current = false
            }}
          />
          <KeyButton
            accessibilityLabel={keyboardVisible ? 'Hide keyboard' : 'Show keyboard'}
            colors={colors}
            label={keyboardVisible ? '⌄' : '⌃'}
            onPress={onKeyboardToggle}
            onPressIn={(): void => {
              focusedAtPressRef.current = false
            }}
          />
        </View>
      </View>
    </View>
  )
}

function KeyButton({
  accessibilityLabel,
  active = false,
  colors,
  label,
  onPress,
  onPressIn,
}: {
  accessibilityLabel?: string
  active?: boolean
  colors: ReturnType<typeof terminalColors>
  label: string
  onPress: () => void
  onPressIn: () => void
}): React.JSX.Element {
  return (
    <Pressable
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityRole="button"
      accessibilityState={{ selected: active }}
      onPress={onPress}
      onPressIn={onPressIn}
      style={{
        alignItems: 'center',
        backgroundColor: active ? colors.activeFill : colors.keyFill,
        borderColor: active ? colors.activeFill : colors.keyBorder,
        borderRadius: 8,
        borderWidth: 1,
        justifyContent: 'center',
        minHeight: 36,
        minWidth: 44,
        paddingHorizontal: 10,
      }}
    >
      <Text
        style={{
          color: active ? colors.activeText : colors.foreground,
          fontSize: 15,
          fontVariant: ['tabular-nums'],
          fontWeight: '600',
        }}
      >
        {label}
      </Text>
    </Pressable>
  )
}
