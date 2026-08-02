import {
  Button,
  ConfirmationDialog,
  Form,
  Picker,
  Section,
  Text,
  TextField,
  useNativeState,
} from '@expo/ui/swift-ui'
import { disabled, pickerStyle, tag } from '@expo/ui/swift-ui/modifiers'
import { router, Stack, useLocalSearchParams } from 'expo-router'
import { useEffect, useMemo, useState } from 'react'

import { ScreenHost } from '@/components/screen-host'
import type { CardStatus } from '@/lib/daemon/procedures/review'
import { useBoardCardActions, useBoardCards } from './hooks/use-board-cards'

const statuses: readonly { label: string; value: CardStatus }[] = [
  { label: 'To do', value: 'todo' },
  { label: 'Doing', value: 'doing' },
  { label: 'Done', value: 'done' },
]

function firstParam(value: string | string[] | undefined): string {
  return Array.isArray(value) ? (value[0] ?? '') : (value ?? '')
}

export function CardScreen(): React.JSX.Element {
  const params = useLocalSearchParams<{ id?: string; mode?: string }>()
  const id = firstParam(params.id)
  const creating = firstParam(params.mode) === 'create' || id === ''
  const cards = useBoardCards()
  const card = useMemo(() => cards.data?.find((candidate) => candidate.id === id), [cards.data, id])
  const actions = useBoardCardActions()
  const [title, setTitle] = useState(card?.title ?? '')
  const [body, setBody] = useState(card?.body ?? '')
  const [status, setStatus] = useState<CardStatus>(card?.status ?? 'todo')
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [deletePresented, setDeletePresented] = useState(false)
  const nativeTitle = useNativeState(title)
  const nativeBody = useNativeState(body)

  useEffect(() => {
    if (card === undefined) return
    setTitle(card.title)
    setBody(card.body ?? '')
    setStatus(card.status)
    nativeTitle.set(card.title)
    nativeBody.set(card.body ?? '')
  }, [card, nativeBody, nativeTitle])

  async function save(): Promise<void> {
    const nextTitle = title.trim()
    if (nextTitle === '') {
      setError('Cards need a title.')
      return
    }
    setSaving(true)
    setError(null)
    try {
      if (creating) {
        await actions.add(nextTitle, body, status)
      } else {
        await actions.update(id, nextTitle, body)
        if (card !== undefined && card.status !== status) await actions.move(id, status)
      }
      router.back()
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not save the card.')
    } finally {
      setSaving(false)
    }
  }

  async function remove(): Promise<void> {
    setSaving(true)
    try {
      await actions.remove(id)
      router.back()
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not delete the card.')
      setSaving(false)
    }
  }

  return (
    <>
      <Stack.Screen options={{ title: creating ? 'New card' : 'Edit card' }} />
      <ScreenHost>
        <Form>
          <Section>
            <TextField
              onTextChange={(value: string): void => {
                setTitle(value)
                nativeTitle.set(value)
              }}
              placeholder="Title"
              text={nativeTitle}
            />
            <TextField
              axis="vertical"
              onTextChange={(value: string): void => {
                setBody(value)
                nativeBody.set(value)
              }}
              placeholder="Body (optional)"
              text={nativeBody}
            />
            <Picker<CardStatus>
              label="Status"
              modifiers={[pickerStyle('menu')]}
              onSelectionChange={setStatus}
              selection={status}
            >
              {statuses.map((option) => (
                <Text key={option.value} modifiers={[tag(option.value)]}>
                  {option.label}
                </Text>
              ))}
            </Picker>
          </Section>
          <Section>
            <Button
              label={saving ? 'Saving…' : 'Save'}
              modifiers={[disabled(saving || title.trim() === '')]}
              onPress={(): void => {
                save()
              }}
              systemImage="checkmark"
            />
            {creating ? null : (
              <Button
                label="Delete card"
                onPress={(): void => setDeletePresented(true)}
                role="destructive"
                systemImage="trash"
              />
            )}
            {error === null ? null : <Text>{error}</Text>}
          </Section>
        </Form>
      </ScreenHost>
      <ConfirmationDialog
        isPresented={deletePresented}
        onIsPresentedChange={setDeletePresented}
        title="Delete this card?"
      >
        <ConfirmationDialog.Message>
          <Text>This cannot be undone.</Text>
        </ConfirmationDialog.Message>
        <ConfirmationDialog.Actions>
          <Button label="Cancel" role="cancel" />
          <Button
            label="Delete"
            onPress={(): void => {
              remove()
            }}
            role="destructive"
          />
        </ConfirmationDialog.Actions>
      </ConfirmationDialog>
    </>
  )
}
