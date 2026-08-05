import { fileName } from '@porcelain/client-runtime/paths'
import { useRouter } from 'expo-router'
import { Pressable, ScrollView, Text, View } from 'react-native'

import { ChromeGlyph } from '@/components/chrome-glyph'
import { PanelLabel, StatusNote } from '@/components/panel-chrome'
import { Button } from '@/components/ui/button'
import { Text as UiText } from '@/components/ui/text'
import { useShellStore } from '@/features/shell/shell-store'
import { useIsTablet } from '@/features/shell/use-app-window'
import type { Commit } from '@/lib/daemon/procedures/changes'

import { commitTitle, shortHash } from './commit-message'
import { useHistoryStore } from './history-store'
import { useCommitActions } from './use-commit-actions'
import { useCommitMessage, useFileLog, useGitLog } from './use-history'

/**
 * The History companion — "Timeline".
 *
 * Two cards, in the order the web sidebar stacks them: what you can do with the open commit,
 * and the commit history of the file you are reading inside it. Both are about the thing on
 * screen, which is why the tab reports what it has open into one store on both form factors.
 */
export function HistoryCompanion({ active }: { active: boolean }): React.JSX.Element {
  return (
    <ScrollView
      className="flex-1"
      contentContainerClassName="gap-5 px-3 pb-8 pt-1"
      nestedScrollEnabled
      showsVerticalScrollIndicator={false}
      testID="porcelain-history-companion"
    >
      <CommitCard active={active} />
      <FileTimelineCard active={active} />
    </ScrollView>
  )
}

/** The open commit and the two things you can do with it, matching the web row's menu. */
function CommitCard({ active }: { active: boolean }): React.JSX.Element {
  const selection = useHistoryStore((state) => state.selection)
  const hash = selection?.hash ?? null
  const { commits } = useGitLog(active)
  const message = useCommitMessage(hash ?? '', active && hash !== null)
  const { copyHash, copyMessage, status } = useCommitActions()
  // The log is already in cache for the list beside this, so the metadata costs no extra read.
  // A commit older than the log's window simply has no row, and the message carries the title.
  const row = hash === null ? undefined : commits?.find((commit) => commit.hash === hash)

  return (
    <View className="gap-2 rounded-2xl border border-border bg-card p-3">
      <PanelLabel>Commit</PanelLabel>
      {hash === null ? (
        <Text className="text-xs leading-5 text-muted-foreground">
          Open a commit to copy its SHA or its message.
        </Text>
      ) : (
        <>
          <Text className="text-sm font-medium leading-5 text-foreground" numberOfLines={3}>
            {commitTitle(message, hash)}
          </Text>
          <Text className="font-mono text-[11px] text-muted-foreground">
            {row === undefined
              ? shortHash(hash)
              : `${row.author} · ${row.date} · ${shortHash(hash)}`}
          </Text>
          <View className="flex-row flex-wrap gap-2 pt-1">
            <Button
              size="sm"
              testID="porcelain-history-copy-hash"
              variant="outline"
              onPress={() => {
                copyHash(hash)
              }}
            >
              <UiText>Copy SHA</UiText>
            </Button>
            <Button
              size="sm"
              testID="porcelain-history-copy-message"
              variant="outline"
              onPress={() => {
                copyMessage(hash)
              }}
            >
              <UiText>Copy message</UiText>
            </Button>
          </View>
          {status === null ? null : (
            <StatusNote
              failed={status.failed}
              testID="porcelain-history-copy-status"
              text={status.text}
            />
          )}
        </>
      )}
    </View>
  )
}

/**
 * The commit history of the file open in the viewer — who changed it, when, and in which
 * commit. Tapping a row opens that commit, so the entry reads alongside the change.
 */
function FileTimelineCard({ active }: { active: boolean }): React.JSX.Element {
  const path = useHistoryStore((state) => state.timelinePath)
  const commits = useFileLog(path, active)
  const openCommit = useOpenCommitFromCompanion()

  return (
    <View className="gap-2 rounded-2xl border border-border bg-card p-3">
      <PanelLabel>File timeline</PanelLabel>
      {path === null ? (
        <Text className="text-xs leading-5 text-muted-foreground">
          Open a file inside a commit to see its timeline.
        </Text>
      ) : (
        <>
          <Text className="font-mono text-[11px] text-muted-foreground" numberOfLines={1}>
            {fileName(path)}
          </Text>
          {commits === undefined ? (
            <Text
              className="text-xs text-muted-foreground"
              testID="porcelain-history-timeline-loading"
            >
              Loading…
            </Text>
          ) : commits.length === 0 ? (
            <Text
              className="text-xs text-muted-foreground"
              testID="porcelain-history-timeline-empty"
            >
              No history for this file yet.
            </Text>
          ) : (
            <View className="gap-0.5" testID="porcelain-history-timeline">
              {commits.map((commit) => (
                <TimelineRow
                  key={commit.hash}
                  commit={commit}
                  onPress={() => {
                    openCommit(commit.hash)
                  }}
                />
              ))}
            </View>
          )}
        </>
      )}
    </View>
  )
}

function TimelineRow({
  commit,
  onPress,
}: {
  commit: Commit
  onPress: () => void
}): React.JSX.Element {
  return (
    <Pressable
      accessibilityLabel={`${commit.subject}, ${commit.date}, ${shortHash(commit.hash)}`}
      accessibilityRole="button"
      className="flex-row items-center gap-2 rounded-lg px-1 py-1.5 active:bg-accent"
      testID={`porcelain-history-timeline-${shortHash(commit.hash)}`}
      onPress={onPress}
    >
      <View className="min-w-0 flex-1 gap-0.5">
        <Text className="text-[13px] text-foreground" numberOfLines={1}>
          {commit.subject}
        </Text>
        <Text className="text-[11px] text-muted-foreground" numberOfLines={1}>
          {commit.author} · {commit.date} · {shortHash(commit.hash)}
        </Text>
      </View>
      <ChromeGlyph name="chevronRight" size={12} />
    </Pressable>
  )
}

/**
 * Open a commit from the companion, which sits on either side of the shell's two navigation
 * models: the tablet's inspector column drives the viewer through the store, while the phone's
 * bolt sheet has to dismiss itself and push onto the Changes tab's stack instead.
 */
function useOpenCommitFromCompanion(): (hash: string) => void {
  const isTablet = useIsTablet()
  const router = useRouter()
  const select = useHistoryStore((state) => state.openCommit)
  const closeSheet = useShellStore((state) => state.closeSheet)

  return (hash: string): void => {
    if (isTablet) {
      select(hash)
      return
    }
    closeSheet()
    router.push({ params: { hash }, pathname: '/changes/commit/[hash]' })
  }
}
