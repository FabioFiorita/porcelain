import { useMemo, useState } from 'react'
import { SectionList, Text, View } from 'react-native'

import {
  EmptyNote,
  ErrorNote,
  IconAction,
  PanelLabel,
  ScreenHeader,
} from '@/components/panel-chrome'
import { surfaceContentStyle } from '@/components/surface-layout'
import { type CommentAnchor, CommentComposer } from '@/features/comments/comment-composer'
import type { FlowFile } from '@/lib/daemon/procedures/changes'

import { CommitFileRow, type CommitFileRowActions } from './commit-file-row'
import { commitTitle, shortHash, splitCommitMessage } from './commit-message'
import { useCommitFlow, useCommitMessage } from './use-history'

/**
 * One commit: its message, and the files it changed in flow order.
 *
 * This is the level the web packs beside the diff in a single tab. On a phone-width column it
 * is its own screen instead — tapping a file opens that file's diff over it, which is what the
 * tablet's viewer stack and the phone's route stack each do in their own idiom.
 */
export function CommitView({
  active,
  bottomInset = 0,
  hash,
  onBack,
  onOpenAll,
  onOpenFile,
  topInset = 0,
}: {
  active: boolean
  /** Phone: room for the floating tab bar the list scrolls under. */
  bottomInset?: number
  hash: string
  /** Phone: pop back to the list. Omitted on tablet, where the list is always on screen. */
  onBack?: () => void
  onOpenAll: (hash: string) => void
  onOpenFile: (hash: string, path: string) => void
  /** Phone: this view replaces the tab header, so it owns the status-bar inset. */
  topInset?: number
}): React.JSX.Element {
  const message = useCommitMessage(hash, active)
  const { error, groups, isLoading } = useCommitFlow(hash, active)
  const [anchor, setAnchor] = useState<CommentAnchor | null>(null)

  const sections = useMemo(
    () => (groups ?? []).map((group) => ({ data: group.files, layer: group.layer })),
    [groups],
  )
  const fileCount = (groups ?? []).reduce((count, group) => count + group.files.length, 0)

  const actions: CommitFileRowActions = {
    onComment: (path) => {
      setAnchor({ path })
    },
    onOpen: (path) => {
      onOpenFile(hash, path)
    },
  }

  return (
    <View className="flex-1 bg-background" testID="porcelain-history-commit-view">
      <ScreenHeader
        actions={
          <IconAction
            accessibilityLabel="Read the whole commit"
            disabled={fileCount === 0}
            glyph="readAll"
            testID="porcelain-history-commit-read-all"
            onPress={() => {
              onOpenAll(hash)
            }}
          />
        }
        back={
          onBack === undefined
            ? undefined
            : {
                accessibilityLabel: 'Back to history',
                onPress: onBack,
                testID: 'porcelain-history-commit-back',
              }
        }
        subtitle={`${shortHash(hash)} · ${fileCount} ${fileCount === 1 ? 'file' : 'files'}`}
        title={commitTitle(message, hash)}
        topInset={topInset}
      />

      {error !== null ? (
        <View className="p-4">
          <ErrorNote message={error.message} testID="porcelain-history-commit-error" />
        </View>
      ) : isLoading && groups === undefined ? (
        <Text
          className="p-4 text-sm text-muted-foreground"
          testID="porcelain-history-commit-loading"
        >
          Loading…
        </Text>
      ) : (
        <SectionList
          contentContainerStyle={surfaceContentStyle({ bottomInset, gap: 2 })}
          keyExtractor={(file: FlowFile) => file.path}
          ListEmptyComponent={
            <EmptyNote
              body="This commit records a message and nothing else — a merge or an empty commit."
              testID="porcelain-history-commit-empty"
              title="No files changed"
            />
          }
          ListHeaderComponent={<CommitMessageCard hash={hash} message={message} />}
          renderItem={({ item }) => <CommitFileRow actions={actions} file={item} />}
          renderSectionHeader={({ section }) => (
            <View className="bg-background pb-1 pt-3">
              <PanelLabel>{section.layer}</PanelLabel>
            </View>
          )}
          sections={sections}
          stickySectionHeadersEnabled={false}
          testID="porcelain-history-commit-files"
        />
      )}

      <CommentComposer
        anchor={anchor}
        testIDPrefix="porcelain-history-comment"
        onClose={() => {
          setAnchor(null)
        }}
      />
    </View>
  )
}

/**
 * The commit's own words. The body is rendered whole rather than truncated — a trailer or a
 * "why" paragraph is often the most valuable thing in a commit, and this is the one screen
 * that has room for it.
 */
function CommitMessageCard({
  hash,
  message,
}: {
  hash: string
  message: string | undefined
}): React.JSX.Element {
  const { body, subject } = splitCommitMessage(message ?? '')

  return (
    <View
      className="mb-1 gap-2 rounded-2xl border border-border bg-card p-3"
      testID="porcelain-history-commit-message"
    >
      <Text className="text-sm font-semibold leading-5 text-foreground" selectable>
        {message === undefined ? '…' : subject === '' ? shortHash(hash) : subject}
      </Text>
      {body === '' ? null : (
        <Text className="font-mono text-[11px] leading-4 text-muted-foreground" selectable>
          {body}
        </Text>
      )}
      <Text className="font-mono text-[10px] text-muted-foreground/70" selectable>
        {hash}
      </Text>
    </View>
  )
}
