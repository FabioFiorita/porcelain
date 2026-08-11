import type { BoardStatus } from '@porcelain/contracts/board'
import { useEffect, useState } from 'react'
import { Text, View } from 'react-native'

import { SegmentedControl } from '@/components/segmented-control'
import { ShellModal, useShellModalSize } from '@/components/shell-modal'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Text as UiText } from '@/components/ui/text'
import { Textarea } from '@/components/ui/textarea'

import { BOARD_COLUMNS, useBoardCardActions } from './board-data'
import { type ComposerHost, useBoardStore } from './board-store'

/**
 * The one create/edit-card form, driven by the draft in the board store.
 *
 * Every panel mounts it and passes its own host name; only the panel named by the draft
 * presents it, so the list, the kanban, the Focus rail, and the phone body can never open two
 * different dialogs for the same card. Editing a card's column here is a move, which is why
 * saving an edit can be two writes.
 */
export function CardComposer({ host }: { host: ComposerHost }): React.JSX.Element {
  const draft = useBoardStore((state) => state.draft)
  const close = useBoardStore((state) => state.closeDraft)
  const { add, move, update } = useBoardCardActions()
  const { width } = useShellModalSize()
  const [title, setTitle] = useState('')
  const [body, setBody] = useState('')
  const [status, setStatus] = useState<BoardStatus>('todo')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const mine = draft !== null && draft.host === host
  const editing = mine && draft.id !== undefined

  // Fresh fields per draft — a title left from the last card would be filed against this one.
  useEffect(() => {
    if (draft === null || draft.host !== host) return
    setTitle(draft.title)
    setBody(draft.body)
    setStatus(draft.status)
    setError(null)
  }, [draft, host])

  const handleSave = async (): Promise<void> => {
    if (draft === null || title.trim() === '' || saving) return
    setSaving(true)
    setError(null)
    try {
      if (draft.id === undefined) {
        await add({
          status,
          title: title.trim(),
          ...(body.trim() === '' ? {} : { body: body.trim() }),
        })
      } else {
        await update(draft.id, { body: body.trim(), title: title.trim() })
        if (status !== draft.status) await move(draft.id, status)
      }
      close()
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not save the card.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <ShellModal
      contentStyle={{ width }}
      open={mine}
      title={editing ? 'Edit card' : 'New card'}
      onClose={close}
    >
      <View className="gap-3" testID="porcelain-board-composer">
        <Input
          accessibilityLabel="Card title"
          autoFocus={mine}
          placeholder="Title"
          testID="porcelain-board-composer-title"
          value={title}
          onChangeText={setTitle}
        />
        <Textarea
          accessibilityLabel="Card details"
          className="min-h-24"
          placeholder="Details (optional)"
          testID="porcelain-board-composer-body"
          value={body}
          onChangeText={setBody}
        />
        <SegmentedControl<BoardStatus>
          options={BOARD_COLUMNS.map((column) => ({
            label: column.label,
            testID: `porcelain-board-composer-status-${column.status}`,
            value: column.status,
          }))}
          testID="porcelain-board-composer-status"
          value={status}
          onChange={setStatus}
        />
        {error === null ? null : (
          <Text className="text-xs text-destructive" testID="porcelain-board-composer-error">
            {error}
          </Text>
        )}
        <View className="flex-row justify-end gap-2">
          <Button testID="porcelain-board-composer-cancel" variant="ghost" onPress={close}>
            <UiText>Cancel</UiText>
          </Button>
          <Button
            disabled={title.trim() === '' || saving}
            testID="porcelain-board-composer-save"
            onPress={() => {
              handleSave()
            }}
          >
            <UiText>{saving ? 'Saving…' : editing ? 'Save' : 'Add card'}</UiText>
          </Button>
        </View>
      </View>
    </ShellModal>
  )
}
