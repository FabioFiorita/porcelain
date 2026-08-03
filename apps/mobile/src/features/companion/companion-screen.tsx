import { Button, List, Section, Text, VStack } from '@expo/ui/swift-ui'
import { buttonStyle, font, listStyle } from '@expo/ui/swift-ui/modifiers'
import { router, useNavigation } from 'expo-router'
import { useLayoutEffect, useState } from 'react'

import { DaemonGate } from '@/components/daemon-gate'
import { ListLinkRow } from '@/components/list-link-row'
import { ScreenHost } from '@/components/screen-host'
import { SheetCloseToolbar } from '@/components/sheet-close-toolbar'
import { ActionsScreen } from '@/features/changes/actions-screen'
import { QuickCommandsSection } from '@/features/changes/components/quick-commands-section'
import { useChangesMutations } from '@/features/changes/data/mutations'
import { useSuggestions } from '@/features/changes/data/queries'
import { basename, repoRelativePath } from '@/features/files/file-paths'
import { useFileEntryActions, usePinnedFileEntries } from '@/features/files/use-files'
import { useBoardCardActions, useBoardCards } from '@/features/review/hooks/use-board-cards'
import { useFeatureReading } from '@/features/review/hooks/use-feature-reading'
import { useReviewComments } from '@/features/review/hooks/use-review-comments'
import { useReviewedPaths } from '@/features/review/hooks/use-reviewed'
import {
  lifecycleBadgeLabel,
  lifecycleDetail,
  reviewLifecyclePhase,
} from '@/features/review/lifecycle'
import { outlineFiles } from '@/features/review/review-outline'
import { TerminalActionsSection } from '@/features/terminal/terminal-actions-section'
import { useTerminalActions } from '@/features/terminal/use-terminal-actions'
import type { ActiveSurface } from '@/lib/active-surface'
import { useActiveSurface } from '@/lib/active-surface'
import type { CardStatus } from '@/lib/daemon/procedures/review'
import { useActiveRepo } from '@/lib/daemon/repo'
import { useTabFaces } from '@/lib/tab-faces'
import { secondary } from '@/theme/modifiers'

/** Sheet / inspector titles — match desktop right-rail labels. */
const COMPANION_TITLES: Record<ActiveSurface, string> = {
  files: 'Pinned & notes',
  search: 'Search',
  changes: 'Commit',
  history: 'Commands',
  review: 'Now reading',
  board: 'Focus',
  terminal: 'Actions',
  settings: 'Companion',
}

function openBoardFace(): void {
  useTabFaces.getState().setReview('board')
  router.push('/(tabs)/(review)')
}

/**
 * Right-rail analogue. Desktop retitles by sidebar tab; phone is a form sheet; iPad is the
 * SplitView inspector. Content follows `useActiveSurface` (last focused product face).
 */
export function CompanionScreen({ embedded = false }: { embedded?: boolean }): React.JSX.Element {
  const surface = useActiveSurface((state) => state.surface)
  const navigation = useNavigation()
  const ownsClose = surface === 'changes' || surface === 'history'

  useLayoutEffect(() => {
    navigation.setOptions({ title: COMPANION_TITLES[surface] })
  }, [navigation, surface])

  return (
    <>
      {!embedded && !ownsClose ? <SheetCloseToolbar /> : null}
      <DaemonGate requires="repo">
        <CompanionBody embedded={embedded} surface={surface} />
      </DaemonGate>
    </>
  )
}

function CompanionBody({
  embedded,
  surface,
}: {
  embedded: boolean
  surface: ActiveSurface
}): React.JSX.Element {
  switch (surface) {
    case 'changes':
      // Full commit composer + quick commands — the one companion that was already right.
      return <ActionsScreen showClose={!embedded} />
    case 'history':
      return <HistoryCompanion />
    case 'terminal':
      return <TerminalCompanion />
    case 'board':
      return <BoardCompanion />
    case 'review':
      return <ReviewCompanion />
    case 'files':
      return <FilesCompanion />
    case 'search':
      return <SearchCompanion />
    default:
      return (
        <ScreenHost>
          <List modifiers={[listStyle('insetGrouped')]}>
            <Section>
              <Text modifiers={[secondary]}>
                Companion follows the surface under the bolt — Changes (commit), Review, Board,
                Files, Search, History, or Terminal.
              </Text>
            </Section>
          </List>
        </ScreenHost>
      )
  }
}

/** Desktop: Pinned & notes. Mobile: live pin list + project picker. */
function FilesCompanion(): React.JSX.Element {
  const repo = useActiveRepo()
  const pinned = usePinnedFileEntries(repo?.path ?? '', repo !== null)
  const actions = useFileEntryActions(repo?.path ?? null)
  const pins = pinned.data ?? []

  return (
    <ScreenHost>
      <List modifiers={[listStyle('insetGrouped')]}>
        <Section title="Pinned">
          {pins.length === 0 ? (
            <Text modifiers={[secondary]}>
              Nothing pinned yet. Pin a file or folder from its row menu on the Files tab.
            </Text>
          ) : (
            pins.map((entry) => {
              const relative =
                repo === null ? entry.name : (repoRelativePath(repo.path, entry.path) ?? entry.name)
              return (
                <ListLinkRow
                  detail={entry.kind === 'dir' ? 'Folder' : 'File'}
                  icon={entry.kind === 'dir' ? 'folder' : 'doc.text'}
                  key={entry.path}
                  label={basename(relative) || relative || entry.name}
                  onPress={(): void => {
                    if (repo === null) return
                    const href =
                      entry.kind === 'dir'
                        ? `/(tabs)/(files)/dir/${relative}`
                        : `/(tabs)/(files)/file/${relative}`
                    router.push(href as never)
                  }}
                />
              )
            })
          )}
        </Section>
        {pins.length > 0 ? (
          <Section title="Manage">
            {pins.map((entry) => (
              <Button
                key={`unpin-${entry.path}`}
                label={`Unpin ${entry.name}`}
                onPress={(): void => {
                  actions.unpin(entry.path)
                }}
                systemImage="pin.slash"
              />
            ))}
          </Section>
        ) : null}
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

/** Desktop: Recent searches. Mobile: short guidance (no recent-store yet). */
function SearchCompanion(): React.JSX.Element {
  return (
    <ScreenHost>
      <List modifiers={[listStyle('insetGrouped')]}>
        <Section title="Search">
          <Text modifiers={[secondary]}>
            Type in the Search tab to filter filenames in this repo. Results open as file rows — the
            bolt stays for project and pin jumps.
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

/** Desktop: Timeline + quick commands. Mobile: quick commands (history list is the tab face). */
function HistoryCompanion(): React.JSX.Element {
  const mutations = useChangesMutations()
  const suggestions = useSuggestions()

  return (
    <ScreenHost>
      <List modifiers={[listStyle('insetGrouped')]}>
        <QuickCommandsSection mutations={mutations} suggestions={suggestions.data ?? []} />
        <Section>
          <Text modifiers={[secondary]}>
            Commit history is the History face on the Changes tab. Re-tap Changes to open it.
          </Text>
        </Section>
      </List>
    </ScreenHost>
  )
}

/** Desktop: Now reading — lifecycle, outline progress, comments. */
function ReviewCompanion(): React.JSX.Element {
  const reading = useFeatureReading()
  const reviewed = useReviewedPaths()
  const comments = useReviewComments()
  const data = reading.data ?? null
  const reviewedPaths = reviewed.data ?? []
  const openComments = (comments.data ?? []).filter((c) => !c.resolved)

  if (data === null) {
    return (
      <ScreenHost>
        <List modifiers={[listStyle('insetGrouped')]}>
          <Section title="Review">
            <Text modifiers={[secondary]}>
              No published unit yet. Ask the agent for Intent first; Execution and Evidence grow
              from there.
            </Text>
          </Section>
          <Section>
            <ListLinkRow icon="rectangle.3.group.fill" label="Open Board" onPress={openBoardFace} />
          </Section>
        </List>
      </ScreenHost>
    )
  }

  const phase = reviewLifecyclePhase(data, reviewedPaths)
  const badge = lifecycleBadgeLabel(phase)
  const detail =
    phase === 'empty'
      ? null
      : lifecycleDetail(data, phase === 'ready_to_close' ? 'ready_to_close' : 'in_progress')
  const outline = outlineFiles(data)
  const reviewedCount = outline.filter((f) => reviewedPaths.includes(f.path)).length

  return (
    <ScreenHost>
      <List modifiers={[listStyle('insetGrouped')]}>
        <Section title="Now reading">
          <VStack alignment="leading" spacing={6}>
            <Text modifiers={[font({ textStyle: 'headline' })]}>{data.name}</Text>
            {badge === null ? null : <Text modifiers={[secondary]}>{badge}</Text>}
            {detail === null ? null : <Text modifiers={[secondary]}>{detail}</Text>}
            <Text modifiers={[secondary]}>
              {reviewedCount}/{outline.length} outline files marked reviewed
            </Text>
          </VStack>
        </Section>
        <Section title="Comments">
          <ListLinkRow
            detail={openComments.length === 0 ? 'None open' : `${openComments.length} open`}
            icon="text.bubble"
            label="Review comments"
            onPress={(): void => router.push('/comments')}
          />
        </Section>
        <Section>
          <ListLinkRow icon="rectangle.3.group.fill" label="Board" onPress={openBoardFace} />
        </Section>
      </List>
    </ScreenHost>
  )
}

/** Desktop: Focus — selected card detail + move. */
function BoardCompanion(): React.JSX.Element {
  const query = useBoardCards()
  const actions = useBoardCardActions()
  const cards = query.data ?? []
  const focus =
    cards.find((card) => card.status === 'doing') ??
    cards.find((card) => card.status === 'todo') ??
    cards[0]

  if (focus === undefined) {
    return (
      <ScreenHost>
        <List modifiers={[listStyle('insetGrouped')]}>
          <Section title="Focus">
            <Text modifiers={[secondary]}>
              No cards yet. Add one from the Board face (re-tap Review).
            </Text>
          </Section>
          <Section>
            <ListLinkRow icon="plus" label="Open Board" onPress={openBoardFace} />
          </Section>
        </List>
      </ScreenHost>
    )
  }

  return (
    <ScreenHost>
      <List modifiers={[listStyle('insetGrouped')]}>
        <Section title="Focus">
          <VStack alignment="leading" spacing={6}>
            <Text modifiers={[font({ textStyle: 'headline' })]}>{focus.title}</Text>
            <Text modifiers={[secondary]}>{statusLabel(focus.status)}</Text>
            {focus.body === undefined || focus.body.trim() === '' ? null : (
              <Text modifiers={[secondary]}>{focus.body}</Text>
            )}
          </VStack>
        </Section>
        <Section title="Move">
          {(['todo', 'doing', 'done'] as const).map((status) => (
            <Button
              key={status}
              label={statusLabel(status)}
              modifiers={[buttonStyle(focus.status === status ? 'borderedProminent' : 'bordered')]}
              onPress={(): void => {
                if (focus.status === status) return
                actions.move(focus.id, status)
              }}
            />
          ))}
        </Section>
        <Section>
          <ListLinkRow icon="rectangle.3.group.fill" label="Open Board" onPress={openBoardFace} />
          <ListLinkRow
            icon="plus"
            label="New card"
            onPress={(): void => {
              openBoardFace()
              router.push('/card?mode=create')
            }}
          />
        </Section>
      </List>
    </ScreenHost>
  )
}

function statusLabel(status: CardStatus): string {
  if (status === 'todo') return 'To do'
  if (status === 'doing') return 'Doing'
  return 'Done'
}

/** Desktop: Actions — saved named commands. */
function TerminalCompanion(): React.JSX.Element {
  const { actions, runAction, error, isPending, refetch } = useTerminalActions()
  const [runningId, setRunningId] = useState<string | null>(null)

  return (
    <ScreenHost>
      <List modifiers={[listStyle('insetGrouped')]}>
        {error !== null ? (
          <Section>
            <Text modifiers={[secondary]}>{error.message}</Text>
            <Button
              label="Retry"
              onPress={(): void => {
                refetch()
              }}
              systemImage="arrow.clockwise"
            />
          </Section>
        ) : null}
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
          runningId={runningId ?? (isPending ? '__pending__' : null)}
        />
        <Section>
          <ListLinkRow
            icon="terminal"
            label="Open Terminal"
            onPress={(): void => router.push('/(tabs)/(terminal)')}
          />
          <ListLinkRow
            icon="plus"
            label="Start a shell"
            onPress={(): void => router.push('/(tabs)/(terminal)/new')}
          />
        </Section>
      </List>
    </ScreenHost>
  )
}
