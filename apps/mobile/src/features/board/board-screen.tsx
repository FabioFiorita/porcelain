import {
  Button,
  ConfirmationDialog,
  HStack,
  List,
  Section,
  Spacer,
  Text,
  VStack,
} from '@expo/ui/swift-ui'
import { buttonStyle, font, foregroundStyle } from '@expo/ui/swift-ui/modifiers'
import { ObserveInteractiveMarker } from 'expo-observe'
import { router } from 'expo-router'
import { useState } from 'react'

import { DaemonGate } from '@/components/daemon-gate'
import { ScreenHeader } from '@/components/screen-header'
import { ScreenHost } from '@/components/screen-host'
import { useSurfaceFocus } from '@/components/use-surface-focus'
import { QueryNotice } from '@/features/changes/components/query-notice'
import { useBoardCardActions, useBoardCards } from '@/features/review/hooks/use-board-cards'
import type { BoardCard, CardStatus } from '@/lib/daemon/procedures/review'

const columns: readonly { label: string; status: CardStatus }[] = [
  { label: 'To do', status: 'todo' },
  { label: 'Doing', status: 'doing' },
  { label: 'Done', status: 'done' },
]

export function BoardScreen(): React.JSX.Element {
  useSurfaceFocus('board')

  return (
    <>
      <DaemonGate requires="repo">
        <BoardBody />
      </DaemonGate>
      {/* Same chrome as Review — full tab face, not a pushed screen with a back chevron. */}
      <ScreenHeader
        actions={[{ href: '/card?mode=create', icon: 'add', label: 'Add card' }]}
        title="Board"
      />
      <ObserveInteractiveMarker />
    </>
  )
}

function BoardBody(): React.JSX.Element {
  const query = useBoardCards()
  const actions = useBoardCardActions()
  const [clearPresented, setClearPresented] = useState(false)
  const done = query.data?.filter((card) => card.status === 'done') ?? []

  return (
    <ScreenHost>
      <List>
        {query.data === undefined ? (
          <Section>
            <QueryNotice
              description="Reading the project board from the daemon."
              error={query.error}
              isPending={query.isPending}
              onRetry={(): void => {
                query.refetch()
              }}
              symbol="checkmark.seal"
              title="Board is loading"
            />
          </Section>
        ) : null}
        {columns.map((column) => {
          const cards = (query.data ?? []).filter((card) => card.status === column.status)
          return (
            <Section
              key={column.status}
              title={`${column.label} · ${cards.length}`}
              footer={
                column.status === 'done' && cards.length > 0 ? (
                  <Button
                    label="Clear done"
                    modifiers={[
                      buttonStyle('borderless'),
                      foregroundStyle({ color: '#FF3B30', type: 'color' }),
                    ]}
                    onPress={(): void => setClearPresented(true)}
                  />
                ) : undefined
              }
            >
              {cards.length === 0 ? (
                <Text modifiers={[font({ textStyle: 'footnote' })]}>Nothing here.</Text>
              ) : null}
              {cards.map((card) => (
                <BoardCardRow card={card} key={card.id} />
              ))}
            </Section>
          )
        })}
      </List>
      <ConfirmationDialog
        isPresented={clearPresented}
        onIsPresentedChange={setClearPresented}
        title="Clear done cards?"
      >
        <ConfirmationDialog.Message>
          <Text>{`Remove ${done.length} completed card${done.length === 1 ? '' : 's'}?`}</Text>
        </ConfirmationDialog.Message>
        <ConfirmationDialog.Actions>
          <Button label="Cancel" role="cancel" />
          <Button
            label="Clear"
            onPress={(): void => {
              actions.clear('done')
              setClearPresented(false)
            }}
            role="destructive"
          />
        </ConfirmationDialog.Actions>
      </ConfirmationDialog>
    </ScreenHost>
  )
}

function BoardCardRow({ card }: { card: BoardCard }): React.JSX.Element {
  return (
    <Button
      modifiers={[buttonStyle('plain')]}
      onPress={(): void =>
        router.push({ params: { id: card.id }, pathname: '/(tabs)/(review)/card' })
      }
    >
      <HStack spacing={10}>
        <VStack alignment="leading" spacing={3}>
          <Text modifiers={[font({ weight: 'semibold' })]}>{card.title}</Text>
          {card.body === undefined || card.body.trim() === '' ? null : (
            <Text modifiers={[font({ textStyle: 'footnote' })]}>{card.body}</Text>
          )}
        </VStack>
        <Spacer />
        <Text modifiers={[font({ textStyle: 'caption2' })]}>{card.status}</Text>
      </HStack>
    </Button>
  )
}
