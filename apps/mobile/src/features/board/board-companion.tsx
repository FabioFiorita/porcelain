import { useState } from 'react'
import { ScrollView, Text, View } from 'react-native'

import { ChromeGlyph } from '@/components/chrome-glyph'
import {
  ActionSheet,
  ConfirmDialog,
  EmptyNote,
  ErrorNote,
  PanelLabel,
  type SheetAction,
} from '@/components/panel-chrome'
import { Button } from '@/components/ui/button'
import { Text as UiText } from '@/components/ui/text'
import { useShellStore } from '@/features/shell/shell-store'
import { useTabFaces } from '@/features/shell/tab-faces'
import { useIsTablet } from '@/features/shell/use-app-window'
import type { BoardCard } from '@/lib/daemon/procedures/review'
import { useActiveRepo } from '@/lib/daemon/repo'

import { COLUMN_GLYPH } from './board-column'
import { draftFromCard, resolveBoardFocus, useBoardStore } from './board-store'
import { CardComposer } from './card-composer'
import { useReviewHandoffStore } from './review-handoff-store'
import {
  BOARD_COLUMNS,
  STATUS_LABEL,
  useBoardCards,
  useBoardFailure,
  useCardActions,
} from './use-board'

/**
 * The Board companion — "Focus": the selected card in full, with the things you can do to it.
 *
 * Default is the first Doing card (then To do, then Done), so opening the rail with nothing
 * selected still answers "what am I on". Edit, move, and delete live here and only here — the
 * columns stay an index rather than a second editor.
 */
export function BoardCompanion({ active }: { active: boolean }): React.JSX.Element {
  const { cards, error, isLoading } = useBoardCards(active)
  const repo = useActiveRepo()
  const focusKey = useBoardStore((state) => state.focus)
  const card = resolveBoardFocus(cards, repo?.path ?? null, focusKey)

  return (
    <ScrollView
      className="flex-1"
      contentContainerClassName="gap-3 px-4 pb-8 pt-3"
      nestedScrollEnabled
      showsVerticalScrollIndicator={false}
      testID="porcelain-board-companion"
    >
      {error === null ? null : (
        <ErrorNote
          message={`Couldn't load the board. ${error.message}`}
          testID="porcelain-board-focus-error"
        />
      )}

      {isLoading ? (
        <Text className="py-6 text-sm text-muted-foreground" testID="porcelain-board-focus-loading">
          Loading board…
        </Text>
      ) : card === null ? (
        error === null ? (
          <View className="gap-2">
            <PanelLabel>Focus</PanelLabel>
            <EmptyNote
              body="Add one from the Board — it opens here."
              testID="porcelain-board-focus-empty"
              title="No cards yet"
            />
          </View>
        ) : null
      ) : (
        <View className="gap-2">
          <PanelLabel>Focus</PanelLabel>
          <FocusCard card={card} />
        </View>
      )}

      <CardComposer host="companion" />
    </ScrollView>
  )
}

function FocusCard({ card }: { card: BoardCard }): React.JSX.Element {
  const { move, remove } = useCardActions()
  const { failure, guard } = useBoardFailure()
  const openDraft = useBoardStore((state) => state.openDraft)
  const startReview = useStartReview()
  const [moving, setMoving] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const body = card.body?.trim() ?? ''

  const moveActions: SheetAction[] = BOARD_COLUMNS.filter(
    (column) => column.status !== card.status,
  ).map((column) => ({
    glyph: COLUMN_GLYPH[column.status],
    id: column.status,
    label: column.label,
    onPress: () => {
      guard('Move card failed', () => move(card.id, column.status))
    },
  }))

  return (
    <View
      className="gap-3 rounded-2xl border border-border bg-card p-3"
      testID="porcelain-board-focus"
    >
      {/* The section caption above says "Focus"; the card keeps its own status so the column
          a card sits in never has to be inferred from the board behind the sheet. */}
      <View className="flex-row items-center gap-1.5">
        <ChromeGlyph name={COLUMN_GLYPH[card.status]} size={12} />
        <Text className="text-[11px] font-medium text-muted-foreground">
          {STATUS_LABEL[card.status]}
        </Text>
      </View>

      <Text className="text-sm font-medium leading-5 text-foreground">{card.title}</Text>
      {body === '' ? (
        <Text className="text-[11px] leading-4 text-muted-foreground">No details</Text>
      ) : (
        <Text className="text-xs leading-5 text-muted-foreground">{body}</Text>
      )}

      {failure === null ? null : (
        <ErrorNote message={failure} testID="porcelain-board-focus-action-error" />
      )}

      <View className="flex-row flex-wrap items-center gap-2 border-t border-border pt-2">
        <Button
          size="sm"
          testID="porcelain-board-focus-edit"
          variant="outline"
          onPress={() => {
            openDraft(draftFromCard(card, 'companion'))
          }}
        >
          <UiText>Edit</UiText>
        </Button>
        {card.status === 'done' ? null : (
          <Button
            size="sm"
            testID="porcelain-board-focus-start-review"
            variant="outline"
            onPress={() => {
              startReview(card)
            }}
          >
            <UiText>Start Review</UiText>
          </Button>
        )}
        <Button
          size="sm"
          testID="porcelain-board-focus-move"
          variant="outline"
          onPress={() => {
            setMoving(true)
          }}
        >
          <UiText>Move</UiText>
        </Button>
        <Button
          size="sm"
          testID="porcelain-board-focus-delete"
          variant="ghost"
          onPress={() => {
            setConfirmDelete(true)
          }}
        >
          <UiText className="text-destructive">Delete</UiText>
        </Button>
      </View>

      <ActionSheet
        actions={moveActions}
        open={moving}
        subtitle={`In ${STATUS_LABEL[card.status]}`}
        testID="porcelain-board-focus-move-menu"
        title={card.title}
        onClose={() => {
          setMoving(false)
        }}
      />

      <ConfirmDialog
        body="This permanently deletes the card. Anything it was tracking has to be written down somewhere else first."
        confirmLabel="Delete"
        open={confirmDelete}
        testID="porcelain-board-focus-delete-confirm"
        title={`Delete “${card.title}”?`}
        onCancel={() => {
          setConfirmDelete(false)
        }}
        onConfirm={() => {
          setConfirmDelete(false)
          guard('Delete card failed', () => remove(card.id))
        }}
      />
    </View>
  )
}

/**
 * Hand a card off to the Review surface: its title becomes the suggested name, and the client
 * moves to the Review.
 *
 * Two navigation models again — the tablet's rail selects a surface, while on phone the Review
 * and the Board are two faces of one native tab, so the face flips and the companion sheet that
 * was covering the board gets out of the way.
 */
function useStartReview(): (card: BoardCard) => void {
  const isTablet = useIsTablet()
  const setActiveSurface = useShellStore((state) => state.setActiveSurface)
  const closeSheet = useShellStore((state) => state.closeSheet)
  const setReviewFace = useTabFaces((state) => state.setReview)

  return (card: BoardCard): void => {
    useReviewHandoffStore.getState().suggest(card.title)
    setActiveSurface('review')
    if (isTablet) return
    setReviewFace('review')
    closeSheet()
  }
}
