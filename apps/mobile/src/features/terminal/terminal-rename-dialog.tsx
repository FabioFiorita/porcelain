import { useState } from 'react'
import { View } from 'react-native'

import { Sheet } from '@/components/ui/sheet'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Text as UiText } from '@/components/ui/text'

/**
 * Rename a session's roster label. The name is daemon-owned, so it survives this app closing
 * and shows up in the desktop client's sidebar too — which is the point of renaming at all:
 * "Terminal 3" tells you nothing tomorrow, "web dev server" does.
 *
 * Keyed by session id at the call site so reopening it for another row starts from that row's
 * name rather than the last one's.
 */
export function TerminalRenameDialog({
  initialName,
  onClose,
  onRename,
  open,
}: {
  initialName: string
  onClose: () => void
  onRename: (name: string) => void
  open: boolean
}): React.JSX.Element {
  const [name, setName] = useState(initialName)
  const trimmed = name.trim()

  const submit = (): void => {
    if (trimmed === '') return
    onRename(trimmed)
  }

  return (
    <Sheet open={open} title="Rename terminal" onClose={onClose}>
      <View className="gap-4 px-5" testID="porcelain-terminal-rename">
        <Input
          autoCapitalize="none"
          autoCorrect={false}
          autoFocus={open}
          onChangeText={setName}
          onSubmitEditing={submit}
          placeholder="Terminal name"
          returnKeyType="done"
          testID="porcelain-terminal-rename-input"
          value={name}
        />
        <View className="flex-row justify-end gap-2">
          <Button testID="porcelain-terminal-rename-cancel" variant="ghost" onPress={onClose}>
            <UiText>Cancel</UiText>
          </Button>
          <Button
            disabled={trimmed === ''}
            testID="porcelain-terminal-rename-save"
            onPress={submit}
          >
            <UiText>Rename</UiText>
          </Button>
        </View>
      </View>
    </Sheet>
  )
}
