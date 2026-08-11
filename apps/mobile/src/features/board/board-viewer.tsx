import { Text, View } from 'react-native'

import { EmptyNote, ErrorNote } from '@/components/panel-chrome'

import { BoardColumn } from './board-column'
import { BOARD_COLUMNS, useBoardCards, useFocusCard, useSelectedCardId } from './board-data'
import { CardComposer } from './card-composer'

/**
 * The tablet's viewer column: the wide kanban, three columns side by side.
 *
 * Tablet-only. Each column scrolls on its own so a long To do list never pushes Done off the
 * bottom; the phone reaches the same board one column at a time from its own screen.
 */
export function BoardViewer({ active }: { active: boolean }): React.JSX.Element {
  const { cards, error, isLoading } = useBoardCards(active)
  const focusCard = useFocusCard()
  const selectedId = useSelectedCardId()

  if (error !== null) {
    return (
      <View className="flex-1 justify-center bg-background p-4">
        <ErrorNote
          message={`Couldn't load the board. ${error.message}`}
          testID="porcelain-board-viewer-error"
        />
      </View>
    )
  }

  if (isLoading) {
    return (
      <View className="flex-1 items-center justify-center bg-background">
        <Text className="text-sm text-muted-foreground" testID="porcelain-board-viewer-loading">
          Loading board…
        </Text>
      </View>
    )
  }

  return (
    <View className="flex-1 bg-background" testID="porcelain-board-viewer">
      {cards.length === 0 ? (
        <View className="flex-1 items-center justify-center">
          <EmptyNote
            body="Add one with + on any column in the list beside this board."
            testID="porcelain-board-viewer-empty"
            title="No cards yet"
          />
        </View>
      ) : (
        <View className="min-h-0 flex-1 flex-row gap-3 p-3">
          {BOARD_COLUMNS.map((column) => (
            <BoardColumn
              key={column.status}
              cards={cards}
              fill
              host="viewer"
              onSelect={focusCard}
              selectedId={selectedId}
              status={column.status}
              testIDPrefix="porcelain-board-viewer"
            />
          ))}
        </View>
      )}

      <CardComposer host="viewer" />
    </View>
  )
}
