import { useEffect, useState } from 'react'
import { View } from 'react-native'

import { Sheet } from '@/components/ui/sheet'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Text } from '@/components/ui/text'

import { nameError } from './entry-name'

/**
 * The touch stand-in for the desktop's inline rename field: a modal with one field, one verb,
 * and room to report what the daemon said when it refused.
 *
 * Stays open on failure. A collision ("README.md already exists") is a fixable typo, and a
 * dialog that dismisses itself takes the half-typed name with it.
 */
export function NamePrompt({
  busy,
  confirmLabel,
  description,
  initialValue = '',
  onClose,
  onSubmit,
  open,
  testID,
  title,
}: {
  busy: boolean
  confirmLabel: string
  description: string
  /** Pre-filled for a rename; empty when creating. */
  initialValue?: string
  onClose: () => void
  /** Rejects with the daemon's error, which this shows rather than swallows. */
  onSubmit: (name: string) => Promise<void>
  open: boolean
  testID: string
  title: string
}): React.JSX.Element {
  const [name, setName] = useState(initialValue)
  const [error, setError] = useState<string | null>(null)

  // One prompt component per action, remounted per row, so opening it is what resets the field
  // — a stale name from the last rename must never be the default for the next one.
  useEffect(() => {
    if (open) {
      setName(initialValue)
      setError(null)
    }
  }, [initialValue, open])

  const submit = (): void => {
    const invalid = nameError(name)
    if (invalid !== null) {
      setError(invalid)
      return
    }
    setError(null)
    onSubmit(name.trim())
      .then(onClose)
      .catch((cause: unknown) => {
        setError(cause instanceof Error ? cause.message : String(cause))
      })
  }

  return (
    <Sheet description={description} open={open} title={title} onClose={onClose}>
      <View className="gap-3 px-5" testID={testID}>
        <Input
          accessibilityLabel={title}
          autoCapitalize="none"
          autoCorrect={false}
          editable={!busy}
          placeholder="name"
          returnKeyType="done"
          testID={`${testID}-input`}
          value={name}
          onChangeText={(next) => {
            setName(next)
            setError(null)
          }}
          onSubmitEditing={submit}
        />

        {error === null ? null : (
          <Text className="text-xs leading-4 text-destructive" testID={`${testID}-error`}>
            {error}
          </Text>
        )}

        <View className="flex-row justify-end gap-2">
          <Button testID={`${testID}-cancel`} variant="ghost" onPress={onClose}>
            <Text>Cancel</Text>
          </Button>
          <Button disabled={busy} testID={`${testID}-confirm`} onPress={submit}>
            <Text>{busy ? 'Working…' : confirmLabel}</Text>
          </Button>
        </View>
      </View>
    </Sheet>
  )
}
