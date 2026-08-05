import { memo, useState } from 'react'
import { Pressable, Text, View } from 'react-native'

import { ActionSheet, type SheetAction } from '@/components/panel-chrome'
import type { Commit } from '@/lib/daemon/procedures/changes'
import { cn } from '@/lib/utils'

import { shortHash } from './commit-message'

/** Deterministic per-hash id — never an array index, so the Android tree resolves it. */
export function commitRowTestId(hash: string): string {
  return `porcelain-history-commit-${shortHash(hash)}`
}

export type CommitRowActions = {
  onOpen: (hash: string) => void
  onCopyHash: (hash: string) => void
  onCopyMessage: (hash: string) => void
}

function CommitRowImpl({
  actions,
  commit,
  selected,
}: {
  actions: CommitRowActions
  commit: Commit
  selected: boolean
}): React.JSX.Element {
  const [menuOpen, setMenuOpen] = useState(false)
  const abbreviated = shortHash(commit.hash)

  // The web row's right-click menu, in the shape touch can reach it.
  const menuActions: SheetAction[] = [
    {
      glyph: 'copy',
      id: 'copy-sha',
      label: 'Copy SHA',
      onPress: () => {
        actions.onCopyHash(commit.hash)
      },
    },
    {
      glyph: 'comment',
      id: 'copy-message',
      label: 'Copy commit message',
      onPress: () => {
        actions.onCopyMessage(commit.hash)
      },
    },
  ]

  return (
    <View>
      <Pressable
        accessibilityLabel={`${commit.subject}, ${commit.author}, ${commit.date}, ${abbreviated}`}
        accessibilityRole="button"
        accessibilityState={{ selected }}
        className={cn(
          'min-h-14 gap-0.5 rounded-xl border border-transparent px-3 py-2 active:bg-accent',
          selected && 'border-border bg-muted/70',
        )}
        testID={commitRowTestId(commit.hash)}
        onLongPress={() => {
          setMenuOpen(true)
        }}
        onPress={() => {
          actions.onOpen(commit.hash)
        }}
      >
        <Text className="text-[13px] font-medium text-foreground" numberOfLines={2}>
          {commit.subject}
        </Text>
        <Text className="text-[11px] text-muted-foreground" numberOfLines={1}>
          {commit.author} · {commit.date} ·{' '}
          <Text className="font-mono text-[11px] text-muted-foreground">{abbreviated}</Text>
        </Text>
      </Pressable>

      <ActionSheet
        actions={menuActions}
        open={menuOpen}
        subtitle={abbreviated}
        testID="porcelain-history-commit-menu"
        title={commit.subject}
        onClose={() => {
          setMenuOpen(false)
        }}
      />
    </View>
  )
}

/** Memoized: the log re-polls while you read it, and a repo carries hundreds of rows. */
export const CommitRow = memo(CommitRowImpl)
