import { dirName, fileName } from '@porcelain/client-runtime/paths'
import type { FlowFile } from '@porcelain/contracts/git'
import { memo, useState } from 'react'
import { Pressable, Text, View } from 'react-native'
import { ActionSheet, type SheetAction } from '@/components/panel-chrome'
import { SURFACE_ROW } from '@/components/surface-layout'
import { StatusBadge } from '@/features/diff/status-badge'
import { cn } from '@/lib/utils'

/** Deterministic per-path id — never an array index, so the Android tree resolves it. */
export function commitFileRowTestId(path: string): string {
  const slug = path
    .replace(/[^a-zA-Z0-9_-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(-80)
  return `porcelain-history-file-${slug || 'file'}`
}

export type CommitFileRowActions = {
  onOpen: (path: string) => void
  onComment: (path: string) => void
}

/**
 * A file inside a commit.
 *
 * Deliberately thinner than the Changes row: a commit is already history, so there is nothing
 * here to stage, discard, or tick off as reviewed. What remains is reading it and leaving the
 * agent a note — the same two the web commit view offers.
 */
function CommitFileRowImpl({
  actions,
  file,
}: {
  actions: CommitFileRowActions
  file: FlowFile
}): React.JSX.Element {
  const [menuOpen, setMenuOpen] = useState(false)
  const name = fileName(file.path)
  const directory = dirName(file.path)
  const connects = file.connects.map((entry) => fileName(entry)).join(', ')

  const menuActions: SheetAction[] = [
    {
      glyph: 'commentAdd',
      id: 'comment',
      label: 'Comment on file',
      onPress: () => {
        actions.onComment(file.path)
      },
    },
  ]

  return (
    <View>
      <Pressable
        accessibilityLabel={`${file.status} ${file.path}`}
        accessibilityRole="button"
        // No selected state: opening a file replaces this list with that file's diff on both
        // form factors, so the two are never on screen together.
        className={cn('min-h-12 flex-row items-start gap-2.5', SURFACE_ROW)}
        testID={commitFileRowTestId(file.path)}
        onLongPress={() => {
          setMenuOpen(true)
        }}
        onPress={() => {
          actions.onOpen(file.path)
        }}
      >
        <StatusBadge className="mt-0.5" status={file.status} />
        <View className="min-w-0 flex-1 gap-0.5">
          <View className="flex-row items-center gap-1.5">
            <Text
              className="min-w-0 shrink font-mono text-[13px] text-foreground"
              numberOfLines={1}
            >
              {name}
            </Text>
            {file.additions === undefined ? null : (
              <Text className="shrink-0 font-mono text-3xs text-success">+{file.additions}</Text>
            )}
            {file.deletions === undefined ? null : (
              <Text className="shrink-0 font-mono text-3xs text-destructive">
                −{file.deletions}
              </Text>
            )}
          </View>
          {directory === '' ? null : (
            // Head-truncated: the tail of a path identifies it, the repo root never does.
            <Text
              className="font-mono text-2xs text-muted-foreground"
              ellipsizeMode="head"
              numberOfLines={1}
            >
              {directory}
            </Text>
          )}
          {connects === '' ? null : (
            <Text className="font-mono text-2xs text-muted-foreground/70" numberOfLines={1}>
              → {connects}
            </Text>
          )}
        </View>
      </Pressable>

      <ActionSheet
        actions={menuActions}
        open={menuOpen}
        subtitle={file.path}
        testID="porcelain-history-file-menu"
        title={name}
        onClose={() => {
          setMenuOpen(false)
        }}
      />
    </View>
  )
}

export const CommitFileRow = memo(CommitFileRowImpl)
