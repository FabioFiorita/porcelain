import { useRef } from 'react'
import { Pressable, ScrollView, Text, View } from 'react-native'

import type { ArrowDirection } from './terminal-keys'

type SpecialKey = 'escape' | 'tab' | 'ctrl-c' | ArrowDirection

export function TerminalKeyBar({
  composerOpen,
  ctrlArmed,
  keyboardVisible,
  onKeyboardToggle,
  onRestoreFocus,
  onSpecialKey,
  onToggleComposer,
  onToggleCtrl,
  terminalFocused,
}: {
  composerOpen: boolean
  ctrlArmed: boolean
  keyboardVisible: boolean
  onKeyboardToggle: () => void
  onRestoreFocus: () => void
  onSpecialKey: (key: SpecialKey) => void
  onToggleComposer: () => void
  onToggleCtrl: () => void
  terminalFocused: () => boolean
}): React.JSX.Element {
  const focusedAtPressRef = useRef(false)

  function pressIn(): void {
    focusedAtPressRef.current = terminalFocused()
  }

  function special(key: SpecialKey): void {
    onSpecialKey(key)
    if (focusedAtPressRef.current) onRestoreFocus()
    focusedAtPressRef.current = false
  }

  return (
    <View
      style={{ backgroundColor: '#1f2024', borderBottomColor: '#383a40', borderBottomWidth: 1 }}
    >
      <ScrollView
        contentContainerStyle={{
          alignItems: 'center',
          gap: 8,
          paddingHorizontal: 10,
          paddingVertical: 8,
        }}
        horizontal
        keyboardShouldPersistTaps="always"
        showsHorizontalScrollIndicator={false}
      >
        <KeyButton label="Esc" onPressIn={pressIn} onPress={(): void => special('escape')} />
        <KeyButton label="Tab" onPressIn={pressIn} onPress={(): void => special('tab')} />
        <KeyButton
          active={ctrlArmed}
          label="Ctrl"
          onPressIn={pressIn}
          onPress={(): void => {
            onToggleCtrl()
            if (focusedAtPressRef.current) onRestoreFocus()
            focusedAtPressRef.current = false
          }}
        />
        <KeyButton label="^C" onPressIn={pressIn} onPress={(): void => special('ctrl-c')} />
        <KeyButton label="←" onPressIn={pressIn} onPress={(): void => special('left')} />
        <KeyButton label="↓" onPressIn={pressIn} onPress={(): void => special('down')} />
        <KeyButton label="↑" onPressIn={pressIn} onPress={(): void => special('up')} />
        <KeyButton label="→" onPressIn={pressIn} onPress={(): void => special('right')} />
        <KeyButton
          label={keyboardVisible ? 'Hide keyboard' : 'Keyboard'}
          onPress={onKeyboardToggle}
          onPressIn={(): void => {
            focusedAtPressRef.current = false
          }}
        />
        <KeyButton
          active={composerOpen}
          label={composerOpen ? 'Close composer' : 'Compose'}
          onPress={onToggleComposer}
          onPressIn={(): void => {
            focusedAtPressRef.current = false
          }}
        />
      </ScrollView>
    </View>
  )
}

function KeyButton({
  active = false,
  label,
  onPress,
  onPressIn,
}: {
  active?: boolean
  label: string
  onPress: () => void
  onPressIn: () => void
}): React.JSX.Element {
  return (
    <Pressable
      accessibilityLabel={label}
      accessibilityRole="button"
      onPress={onPress}
      onPressIn={onPressIn}
      style={{
        alignItems: 'center',
        backgroundColor: active ? '#0A84FF' : '#303238',
        borderColor: active ? '#65B5FF' : '#4b4d55',
        borderRadius: 8,
        borderWidth: 1,
        justifyContent: 'center',
        minHeight: 36,
        minWidth: 44,
        paddingHorizontal: 10,
      }}
    >
      <Text style={{ color: '#f2f2f7', fontSize: 14, fontWeight: '600' }}>{label}</Text>
    </Pressable>
  )
}
