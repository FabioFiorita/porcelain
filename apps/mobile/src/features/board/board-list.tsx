import { ScrollView, Text, View } from 'react-native'

import { EmptyNote, ErrorNote } from '@/components/panel-chrome'

import { BoardColumn } from './board-column'
import { CardComposer } from './card-composer'
import { BOARD_COLUMNS, useBoardCards, useFocusCard, useSelectedCardId } from './use-board'

/**
 * The Board's supplementary column on tablet: the three columns stacked down a narrow panel.
 *
 * Same content as the viewer's kanban, folded for the width — the panel beside the wide board
 * is where you add and tick off, and the card you tap opens in the Focus rail.
 */
export function BoardList({ active }: { active: boolean }): React.JSX.Element {
  const { cards, error, isLoading } = useBoardCards(active)
  const focusCard = useFocusCard()
  const selectedId = useSelectedCardId()

  return (
    <View className="flex-1" testID="porcelain-board-list">
      {error === null ? null : (
        <View className="px-[16px] pb-[8px] pt-[12px]">
          <ErrorNote
            message={`Couldn't load the board. ${error.message}`}
            testID="porcelain-board-list-error"
          />
        </View>
      )}

      {isLoading ? (
        <Text
          className="px-[16px] py-6 text-sm text-muted-foreground"
          testID="porcelain-board-list-loading"
        >
          Loading board…
        </Text>
      ) : cards.length === 0 && error === null ? (
        <EmptyNote
          body="Add one with + on any column — cards you and the agent both read."
          testID="porcelain-board-list-empty"
          title="No cards yet"
        />
      ) : (
        <ScrollView
          className="flex-1"
          contentContainerClassName="gap-4 px-[16px] pb-8 pt-3"
          nestedScrollEnabled
          showsVerticalScrollIndicator={false}
          testID="porcelain-board-list-columns"
        >
          {BOARD_COLUMNS.map((column) => (
            <BoardColumn
              key={column.status}
              cards={cards}
              host="list"
              onSelect={focusCard}
              selectedId={selectedId}
              status={column.status}
              testIDPrefix="porcelain-board-list"
            />
          ))}
        </ScrollView>
      )}

      <CardComposer host="list" />
    </View>
  )
}
