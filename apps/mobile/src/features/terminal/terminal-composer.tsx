import { useState } from 'react'
import { Pressable, Switch, Text, TextInput, View } from 'react-native'

import type { AppearanceScheme } from '@/theme/colors'
import { terminalColors } from '@/theme/terminal-colors'

export function TerminalComposer({
  disabled,
  onSend,
  scheme,
}: {
  disabled: boolean
  onSend: (text: string, appendNewline: boolean) => void
  scheme: AppearanceScheme
}): React.JSX.Element {
  const colors = terminalColors(scheme)
  const [text, setText] = useState('')
  const [noNewline, setNoNewline] = useState(false)
  const canSend = text.length > 0 && !disabled

  function send(): void {
    if (!canSend) return
    onSend(text, !noNewline)
    setText('')
  }

  return (
    <View
      style={{
        backgroundColor: colors.surface,
        borderTopColor: colors.border,
        borderTopWidth: 1,
        gap: 8,
        padding: 10,
      }}
    >
      <View style={{ alignItems: 'center', flexDirection: 'row', gap: 8 }}>
        <TextInput
          accessibilityLabel="Terminal composer"
          autoCapitalize="none"
          autoCorrect={false}
          onChangeText={setText}
          onSubmitEditing={send}
          placeholder="Send a line to the shell"
          placeholderTextColor={colors.mutedText}
          returnKeyType="send"
          style={{
            backgroundColor: colors.keyFill,
            borderColor: colors.keyBorder,
            borderRadius: 8,
            borderWidth: 1,
            color: colors.foreground,
            flex: 1,
            minHeight: 40,
            paddingHorizontal: 10,
          }}
          value={text}
        />
        <Pressable
          accessibilityLabel="Send terminal line"
          accessibilityRole="button"
          disabled={!canSend}
          onPress={send}
          style={{
            alignItems: 'center',
            backgroundColor: canSend ? colors.activeFill : colors.keyFill,
            borderRadius: 8,
            justifyContent: 'center',
            minHeight: 40,
            paddingHorizontal: 12,
          }}
        >
          <Text
            style={{ color: canSend ? colors.activeText : colors.mutedText, fontWeight: '600' }}
          >
            Send
          </Text>
        </Pressable>
      </View>
      <View style={{ alignItems: 'center', flexDirection: 'row', gap: 8 }}>
        <Switch onValueChange={setNoNewline} value={noNewline} />
        <Text style={{ color: colors.mutedText, fontSize: 13 }}>No newline</Text>
      </View>
    </View>
  )
}
