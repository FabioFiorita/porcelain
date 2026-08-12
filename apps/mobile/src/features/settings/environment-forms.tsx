import { View } from 'react-native'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Text } from '@/components/ui/text'
import type { EnvironmentId } from '@/features/remote'
import { BackRow, Field } from './environment-chrome'
import { useAddConnectionForm, useCreateGroupForm } from './use-environments-panel'

/**
 * The two link-pasting screens. Both take a connection link from the host's Share settings and
 * both keep it `secureTextEntry`: the link carries the token, so it is a credential on screen.
 */

export function CreateGroupForm({
  onCancel,
  onCreated,
}: {
  onCancel: () => void
  onCreated: (id: EnvironmentId) => void
}): React.JSX.Element {
  const form = useCreateGroupForm(onCreated)

  return (
    <View className="gap-3" testID="porcelain-settings-create-group">
      <BackRow label="Environments" onPress={onCancel} />
      <Text className="text-base font-semibold text-foreground">Create environment group</Text>
      <Text className="text-xs leading-5 text-muted-foreground">
        Pair LAN first. After the group exists you can add Tailscale or Funnel as fallback routes.
      </Text>

      <Field label="Nickname (optional)">
        <Input
          accessibilityLabel="Group nickname"
          autoCapitalize="none"
          autoCorrect={false}
          className="h-10"
          editable={!form.busy}
          placeholder="Defaults to host name"
          testID="porcelain-settings-group-nickname"
          value={form.nickname}
          onChangeText={form.setNickname}
        />
      </Field>

      <Field label="Connection link">
        <Input
          accessibilityLabel="Connection link"
          autoCapitalize="none"
          autoCorrect={false}
          className="h-10 font-mono text-xs"
          editable={!form.busy}
          placeholder="https://…/pair#token=…"
          secureTextEntry
          testID="porcelain-settings-group-link"
          value={form.link}
          onChangeText={form.setLink}
        />
      </Field>

      {form.error ? (
        <Text className="text-xs text-destructive" testID="porcelain-settings-pair-error">
          {form.error}
        </Text>
      ) : null}

      <View className="flex-row gap-2">
        <Button
          className="flex-1"
          disabled={form.busy || form.empty}
          testID="porcelain-settings-pair-submit"
          onPress={() => {
            form.submit()
          }}
        >
          <Text>{form.busy ? 'Pairing…' : 'Create & use'}</Text>
        </Button>
        <Button disabled={form.busy} variant="ghost" onPress={onCancel}>
          <Text>Cancel</Text>
        </Button>
      </View>
    </View>
  )
}

export function AddConnectionForm({
  groupId,
  onCancel,
  onAdded,
}: {
  groupId: EnvironmentId
  onCancel: () => void
  onAdded: () => void
}): React.JSX.Element {
  const form = useAddConnectionForm(groupId, onAdded)

  return (
    <View className="gap-3" testID="porcelain-settings-add-connection">
      <BackRow label="Group" onPress={onCancel} />
      <Text className="text-base font-semibold text-foreground">Add connection</Text>
      <Text className="text-xs leading-5 text-muted-foreground">
        Paste another link for the same daemon. It is verified before joining this group.
      </Text>
      <Field label="Connection link">
        <Input
          accessibilityLabel="Connection link"
          autoCapitalize="none"
          autoCorrect={false}
          className="h-10 font-mono text-xs"
          editable={!form.busy}
          placeholder="https://…/pair#token=…"
          secureTextEntry
          testID="porcelain-settings-add-connection-link"
          value={form.link}
          onChangeText={form.setLink}
        />
      </Field>
      {form.error ? <Text className="text-xs text-destructive">{form.error}</Text> : null}
      <View className="flex-row gap-2">
        <Button
          className="flex-1"
          disabled={form.busy || form.empty}
          testID="porcelain-settings-add-connection-submit"
          onPress={() => {
            form.submit()
          }}
        >
          <Text>{form.busy ? 'Adding…' : 'Add connection'}</Text>
        </Button>
        <Button disabled={form.busy} variant="ghost" onPress={onCancel}>
          <Text>Cancel</Text>
        </Button>
      </View>
    </View>
  )
}
