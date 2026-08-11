import type { BoardStatus } from '@porcelain/contracts/board'
import { useIsFocused } from 'expo-router'
import { Text, View } from 'react-native'

import { ErrorNote } from '@/components/panel-chrome'
import { SegmentedControl } from '@/components/segmented-control'
import { SurfaceScroll } from '@/components/surface-scroll'
import { PhoneHeader } from '@/features/shell/phone-header'

import { BoardColumn } from './board-column'
import {
  BOARD_COLUMNS,
  cardsInColumn,
  useBoardCards,
  useFocusCard,
  useSelectedCardId,
} from './board-data'
import { useBoardStore } from './board-store'
import { CardComposer } from './card-composer'

/**
 * The Board face of the Review tab on phone: the header, a column switcher, and one column.
 *
 * Three columns side by side is a tablet shape — at 390pt it would leave cards two words wide,
 * so the phone shows one column at a time and the segmented control is how you cross between
 * them. Tapping a card focuses it and opens the companion sheet, which is the phone's Focus
 * rail and the one place cards are edited, moved, and deleted.
 */
export function BoardPhoneScreen(): React.JSX.Element {
  const focused = useIsFocused()
  const { cards, error, isLoading } = useBoardCards(focused)
  const column = useBoardStore((state) => state.column)
  const setColumn = useBoardStore((state) => state.setColumn)
  const focusCard = useFocusCard()
  const selectedId = useSelectedCardId()

  return (
    <View className="flex-1 bg-background" testID="porcelain-phone-surface-board">
      <PhoneHeader companionSurface="board" title="Board" />

      <View className="px-4 pb-2 pt-3">
        <SegmentedControl<BoardStatus>
          options={BOARD_COLUMNS.map((entry) => ({
            label: `${entry.label} · ${cardsInColumn(cards, entry.status).length}`,
            testID: `porcelain-board-phone-tab-${entry.status}`,
            value: entry.status,
          }))}
          testID="porcelain-board-phone-tabs"
          value={column}
          onChange={setColumn}
        />
      </View>

      {error === null ? null : (
        <View className="px-4 pb-2">
          <ErrorNote
            message={`Couldn't load the board. ${error.message}`}
            testID="porcelain-board-phone-error"
          />
        </View>
      )}

      {isLoading ? (
        <Text
          className="px-4 py-6 text-sm text-muted-foreground"
          testID="porcelain-board-phone-loading"
        >
          Loading board…
        </Text>
      ) : (
        <SurfaceScroll showsVerticalScrollIndicator={false} testID="porcelain-board-phone-cards">
          <BoardColumn
            cards={cards}
            host="phone"
            onSelect={focusCard}
            selectedId={selectedId}
            status={column}
            testIDPrefix="porcelain-board-phone"
          />
        </SurfaceScroll>
      )}

      <CardComposer host="phone" />
    </View>
  )
}
