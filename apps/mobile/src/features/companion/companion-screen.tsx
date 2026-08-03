import { List, Section, Text } from '@expo/ui/swift-ui'
import { listStyle } from '@expo/ui/swift-ui/modifiers'
import { router } from 'expo-router'
import { useState } from 'react'

import { DaemonGate } from '@/components/daemon-gate'
import { ListLinkRow } from '@/components/list-link-row'
import { ScreenHost } from '@/components/screen-host'
import { SheetCloseToolbar } from '@/components/sheet-close-toolbar'
import { ActionsScreen } from '@/features/changes/actions-screen'
import { useBoardCards } from '@/features/review/hooks/use-board-cards'
import { TerminalActionsSection } from '@/features/terminal/terminal-actions-section'
import { useTerminalActions } from '@/features/terminal/use-terminal-actions'
import { useActiveSurface } from '@/lib/active-surface'
import { useTabFaces } from '@/lib/tab-faces'
import { secondary } from '@/theme/modifiers'

function openBoardFace(): void {
  useTabFaces.getState().setReview('board')
  router.push('/(tabs)/(review)')
}

/**
 * Right-rail analogue. Desktop retitles this by sidebar tab; phone raises it as a form
 * sheet; iPad hosts it in SplitView.Inspector. Content follows the last focused surface.
 */
export function CompanionScreen({ embedded = false }: { embedded?: boolean }): React.JSX.Element {
  const surface = useActiveSurface((state) => state.surface)
  // Changes/history reuse ActionsScreen, which already wears SheetCloseToolbar.
  const ownsClose = surface === 'changes' || surface === 'history'

  return (
    <>
      {!embedded && !ownsClose ? <SheetCloseToolbar /> : null}
      <DaemonGate requires="repo">
        <CompanionBody surface={surface} />
      </DaemonGate>
    </>
  )
}

function CompanionBody({
  surface,
}: {
  surface: ReturnType<typeof useActiveSurface.getState>['surface']
}): React.JSX.Element {
  switch (surface) {
    case 'changes':
    case 'history':
      // Commit composer + quick commands — the Changes companion.
      return <ActionsScreen />
    case 'terminal':
      return <TerminalCompanion />
    case 'board':
      return <BoardCompanion />
    case 'review':
      return <ReviewCompanion />
    case 'files':
      return <FilesCompanion />
    default:
      return (
        <ScreenHost>
          <List modifiers={[listStyle('insetGrouped')]}>
            <Section>
              <Text modifiers={[secondary]}>
                Open a surface — the companion follows Changes (commit), Review, Board, or Terminal
                (actions).
              </Text>
            </Section>
          </List>
        </ScreenHost>
      )
  }
}

function FilesCompanion(): React.JSX.Element {
  return (
    <ScreenHost>
      <List modifiers={[listStyle('insetGrouped')]}>
        <Section title="Pinned & notes">
          <Text modifiers={[secondary]}>
            Pins and the Notes card live here on the desktop. On phone, pin from a file’s menu;
            notes land with the next companion pass.
          </Text>
        </Section>
        <Section>
          <ListLinkRow
            icon="folder"
            label="Choose project…"
            onPress={(): void => router.push('/repo')}
          />
        </Section>
      </List>
    </ScreenHost>
  )
}

function ReviewCompanion(): React.JSX.Element {
  return (
    <ScreenHost>
      <List modifiers={[listStyle('insetGrouped')]}>
        <Section title="Now reading">
          <ListLinkRow
            icon="text.bubble"
            label="Comments"
            onPress={(): void => router.push('/comments')}
          />
          <ListLinkRow icon="rectangle.3.group.fill" label="Board" onPress={openBoardFace} />
        </Section>
      </List>
    </ScreenHost>
  )
}

function BoardCompanion(): React.JSX.Element {
  const query = useBoardCards()
  const doing = query.data?.filter((card) => card.status === 'doing') ?? []
  const focus = doing[0] ?? query.data?.[0]

  return (
    <ScreenHost>
      <List modifiers={[listStyle('insetGrouped')]}>
        <Section title="Focus">
          {focus === undefined ? (
            <Text modifiers={[secondary]}>No cards yet. Add one on the Board.</Text>
          ) : (
            <ListLinkRow detail={focus.status} label={focus.title} onPress={openBoardFace} />
          )}
        </Section>
      </List>
    </ScreenHost>
  )
}

function TerminalCompanion(): React.JSX.Element {
  const { actions, runAction } = useTerminalActions()
  const [runningId, setRunningId] = useState<string | null>(null)

  return (
    <ScreenHost>
      <List modifiers={[listStyle('insetGrouped')]}>
        <TerminalActionsSection
          actions={actions}
          onRun={(action): void => {
            setRunningId(action.id)
            ;(async (): Promise<void> => {
              try {
                const id = await runAction(action)
                router.push(`/session/${id}`)
              } finally {
                setRunningId(null)
              }
            })()
          }}
          runningId={runningId}
        />
      </List>
    </ScreenHost>
  )
}
