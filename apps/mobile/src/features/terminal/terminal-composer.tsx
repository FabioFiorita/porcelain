import { useState } from 'react'
import { Pressable, Switch, Text, TextInput, View } from 'react-native'

export function TerminalComposer({
  disabled,
  onSend,
}: {
  disabled: boolean
  onSend: (text: string, appendNewline: boolean) => void
}): React.JSX.Element {
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
        backgroundColor: '#1f2024',
        borderTopColor: '#383a40',
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
          placeholderTextColor="#8e8e93"
          returnKeyType="send"
          style={{
            backgroundColor: '#303238',
            borderColor: '#4b4d55',
            borderRadius: 8,
            borderWidth: 1,
            color: '#f2f2f7',
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
            backgroundColor: canSend ? '#0A84FF' : '#48484A',
            borderRadius: 8,
            justifyContent: 'center',
            minHeight: 40,
            paddingHorizontal: 12,
          }}
        >
          <Text style={{ color: '#ffffff', fontWeight: '600' }}>Send</Text>
        </Pressable>
      </View>
      <View style={{ alignItems: 'center', flexDirection: 'row', gap: 8 }}>
        <Switch onValueChange={setNoNewline} value={noNewline} />
        <Text style={{ color: '#aeaeb2', fontSize: 13 }}>No newline</Text>
      </View>
    </View>
  )
}
