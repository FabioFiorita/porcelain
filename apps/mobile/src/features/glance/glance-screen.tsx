import { Button, List, Section, Text, VStack } from '@expo/ui/swift-ui'
import { font, padding } from '@expo/ui/swift-ui/modifiers'
import { router } from 'expo-router'

import { DaemonGate } from '@/components/daemon-gate'
import { ListLinkRow } from '@/components/list-link-row'
import { ScreenHost } from '@/components/screen-host'
import { useWorkingFlow } from '@/features/changes/data/queries'
import { useBoardCards } from '@/features/review/hooks/use-board-cards'
import { useFeatureReading } from '@/features/review/hooks/use-feature-reading'
import { useFeatureView } from '@/features/review/hooks/use-feature-view'
import { useActiveRepo } from '@/lib/daemon/repo'
import { useTabFaces } from '@/lib/tab-faces'
import { secondary } from '@/theme/modifiers'

function openBoardFace(): void {
  useTabFaces.getState().setReview('board')
  router.push('/(tabs)/(review)')
}

function openChangesFace(): void {
  useTabFaces.getState().setChanges('changes')
  router.push('/(tabs)/(changes)')
}

/**
 * Phone companion home when nothing is selected — work in flight and jump rows.
 * Mirrors the desktop Glance (empty viewer), sized for a single column.
 */
export function GlanceScreen(): React.JSX.Element {
  return (
    <DaemonGate requires="repo">
      <GlanceBody />
    </DaemonGate>
  )
}

function GlanceBody(): React.JSX.Element {
  const repo = useActiveRepo()
  const flow = useWorkingFlow()
  const view = useFeatureView()
  const reading = useFeatureReading()
  const board = useBoardCards()

  const changedCount = flow.data?.reduce((n, group) => n + group.files.length, 0) ?? 0
  const hasReview = view.data !== null && view.data !== undefined
  const doing = board.data?.filter((card) => card.status === 'doing') ?? []
  const todo = board.data?.filter((card) => card.status === 'todo') ?? []
  const hasBoard = doing.length > 0 || todo.length > 0
  const hasWork = changedCount > 0 || hasReview || hasBoard

  return (
    <ScreenHost>
      <List>
        <Section>
          <VStack alignment="leading" modifiers={[padding({ all: 4 })]} spacing={4}>
            <Text modifiers={[font({ textStyle: 'title3', weight: 'semibold' })]}>
              {repo?.name ?? 'Project'}
            </Text>
            {hasWork ? null : (
              <Text modifiers={[secondary]}>
                Nothing in flight — open Changes, the Board, or a terminal when you start. On phone
                this is a companion to the Mac, iPad, or browser.
              </Text>
            )}
          </VStack>
        </Section>

        {changedCount > 0 || hasReview ? (
          <Section title="This checkout">
            {changedCount > 0 ? (
              <ListLinkRow
                detail={changedCount === 1 ? '1 file' : `${changedCount} files`}
                icon="arrow.triangle.branch"
                label="Changed files"
                onPress={openChangesFace}
              />
            ) : null}
            {hasReview ? (
              <ListLinkRow
                detail={reading.data?.name?.trim() || view.data?.name || 'Published'}
                icon="checkmark.seal"
                label="Review"
                onPress={(): void => {
                  useTabFaces.getState().setReview('review')
                }}
              />
            ) : null}
          </Section>
        ) : null}

        {hasBoard ? (
          <Section title="Board">
            <ListLinkRow
              detail={[
                doing.length > 0 ? `${doing.length} doing` : null,
                todo.length > 0 ? `${todo.length} to do` : null,
              ]
                .filter(Boolean)
                .join(' · ')}
              icon="rectangle.3.group.fill"
              label="Open Board"
              onPress={openBoardFace}
            />
            {doing.slice(0, 3).map((card) => (
              <ListLinkRow key={card.id} label={card.title} onPress={openBoardFace} />
            ))}
          </Section>
        ) : null}

        <Section title="Jump">
          <ListLinkRow icon="arrow.triangle.branch" label="Changes" onPress={openChangesFace} />
          <ListLinkRow icon="rectangle.3.group.fill" label="Board" onPress={openBoardFace} />
          <ListLinkRow
            icon="terminal"
            label="Terminal"
            onPress={(): void => router.push('/(tabs)/(terminal)')}
          />
          <Button
            label="Pair or switch environment"
            onPress={(): void => router.push('/settings')}
            systemImage="gearshape"
          />
        </Section>
      </List>
    </ScreenHost>
  )
}
