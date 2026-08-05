import { useState } from 'react'
import { ScrollView, Text, View } from 'react-native'

import { ChromeGlyph, type ChromeIconName } from '@/components/chrome-glyph'
import { ConfirmDialog, ErrorNote, IconAction, PanelLabel } from '@/components/panel-chrome'
import type { BoardCard, CardStatus } from '@/lib/daemon/procedures/review'
import { cn } from '@/lib/utils'

import { type ComposerHost, useBoardStore } from './board-store'
import { CardRow } from './card-row'
import { cardsInColumn, STATUS_LABEL, useBoardFailure, useCardActions } from './use-board'

/**
 * Column iconography, from the chrome symbol set the whole app shares: an empty box for work
 * not started, the running arrow for work in flight, a filled tick for work that is finished.
 */
export const COLUMN_GLYPH: Record<CardStatus, ChromeIconName> = {
  doing: 'refresh',
  done: 'circleCheck',
  todo: 'square',
}

/**
 * One board column, wherever the board is drawn: `label · count`, the add affordance, and —
 * on Done only — the bulk clear behind a confirmation.
 *
 * The column owns add and clear so the three panels that render it (the tablet list, the wide
 * kanban, the phone body) cannot grow three different versions of the same two writes.
 */
export function BoardColumn({
  cards,
  fill = false,
  host,
  onSelect,
  selectedId,
  status,
  testIDPrefix,
}: {
  cards: readonly BoardCard[]
  /** Kanban: the column owns its height and scrolls its own cards. */
  fill?: boolean
  host: ComposerHost
  onSelect: (card: BoardCard) => void
  selectedId: string | null
  status: CardStatus
  testIDPrefix: string
}): React.JSX.Element {
  const openDraft = useBoardStore((state) => state.openDraft)
  const { clear } = useCardActions()
  const { failure, guard } = useBoardFailure()
  const [confirmClear, setConfirmClear] = useState(false)
  const label = STATUS_LABEL[status]
  const inColumn = cardsInColumn(cards, status)

  const rows =
    inColumn.length === 0 ? (
      <Text
        className="px-1 py-3 text-[11px] text-muted-foreground"
        testID={`${testIDPrefix}-column-empty-${status}`}
      >
        No cards yet
      </Text>
    ) : (
      inColumn.map((card) => (
        <CardRow
          key={card.id}
          card={card}
          selected={card.id === selectedId}
          testID={`${testIDPrefix}-card-${card.id}`}
          onPress={() => {
            onSelect(card)
          }}
        />
      ))
    )

  return (
    <View
      className={cn('gap-1.5', fill && 'min-h-0 min-w-0 flex-1')}
      testID={`${testIDPrefix}-column-${status}`}
    >
      <View className="flex-row items-center gap-1.5 px-1">
        <ChromeGlyph name={COLUMN_GLYPH[status]} size={12} />
        <PanelLabel className="min-w-0 flex-1">{`${label} · ${inColumn.length}`}</PanelLabel>
        {status === 'done' ? (
          <IconAction
            accessibilityLabel="Clear the Done column"
            disabled={inColumn.length === 0}
            glyph="eraser"
            testID={`${testIDPrefix}-clear-${status}`}
            onPress={() => {
              setConfirmClear(true)
            }}
          />
        ) : null}
        <IconAction
          accessibilityLabel={`Add a card to ${label}`}
          glyph="plus"
          testID={`${testIDPrefix}-add-${status}`}
          onPress={() => {
            openDraft({ body: '', host, status, title: '' })
          }}
        />
      </View>

      {failure === null ? null : (
        <ErrorNote message={failure} testID={`${testIDPrefix}-column-error-${status}`} />
      )}

      {fill ? (
        <ScrollView
          className="min-h-0 flex-1"
          contentContainerClassName="gap-1.5 pb-4"
          nestedScrollEnabled
          showsVerticalScrollIndicator={false}
          testID={`${testIDPrefix}-cards-${status}`}
        >
          {rows}
        </ScrollView>
      ) : (
        <View className="gap-1.5" testID={`${testIDPrefix}-cards-${status}`}>
          {rows}
        </View>
      )}

      <ConfirmDialog
        body={`This permanently deletes ${inColumn.length} finished ${inColumn.length === 1 ? 'card' : 'cards'}. To do and Doing are left alone.`}
        confirmLabel="Clear"
        open={confirmClear}
        testID={`${testIDPrefix}-clear-${status}-confirm`}
        title="Clear the Done column?"
        onCancel={() => {
          setConfirmClear(false)
        }}
        onConfirm={() => {
          setConfirmClear(false)
          guard('Clear cards failed', () => clear(status))
        }}
      />
    </View>
  )
}
