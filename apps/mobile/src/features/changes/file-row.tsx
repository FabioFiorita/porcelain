import { dirName, fileName } from '@porcelain/client-runtime/paths'
import { memo, useState } from 'react'
import { Pressable, Text, View } from 'react-native'

import { ChromeGlyph } from '@/components/chrome-glyph'
import { ActionSheet, ConfirmDialog, type SheetAction } from '@/components/panel-chrome'
import { SURFACE_ROW, SURFACE_ROW_SELECTED } from '@/components/surface-layout'
import type { FileStatus, FlowFile } from '@/lib/daemon/procedures/changes'
import { cn } from '@/lib/utils'

/** The one-letter status lead, matching the web row (colour carries the meaning). */
const STATUS_BADGE: Record<FileStatus, { label: string; className: string }> = {
  added: { label: 'A', className: 'text-success' },
  deleted: { label: 'D', className: 'text-destructive' },
  modified: { label: 'M', className: 'text-warning' },
  renamed: { label: 'R', className: 'text-info' },
  untracked: { label: 'U', className: 'text-success' },
}
export type FileRowActions = {
  onOpen: (path: string) => void
  onToggleReviewed: (path: string, reviewed: boolean) => void
  onComment: (path: string) => void
  onStage: (path: string) => void
  onUnstage: (path: string) => void
  onDiscard: (path: string) => void
}

/** Deterministic per-path id — never an array index, so the Android tree resolves it. */
export function fileRowTestId(path: string): string {
  const slug = path
    .replace(/[^a-zA-Z0-9_-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(-80)
  return `porcelain-changes-file-${slug || 'file'}`
}

function FileRowImpl({
  actions,
  file,
  isReviewed,
  selected,
  /** Branch scope: rows are committed content, so staging and discard do not apply. */
  working,
}: {
  actions: FileRowActions
  file: FlowFile
  isReviewed: boolean
  selected: boolean
  working: boolean
}): React.JSX.Element {
  const [menuOpen, setMenuOpen] = useState(false)
  const [confirmDiscard, setConfirmDiscard] = useState(false)
  const name = fileName(file.path)
  const directory = dirName(file.path)
  const connects = file.connects.map((entry) => fileName(entry)).join(', ')
  const badge = STATUS_BADGE[file.status]
  // A file with no committed version is trashed rather than reverted; word the confirmation
  // to match what discard actually does in each case.
  const isNew = file.status === 'untracked' || file.status === 'added'

  const menuActions: SheetAction[] = [
    {
      glyph: isReviewed ? 'square' : 'squareCheck',
      id: 'reviewed',
      label: isReviewed ? 'Unmark reviewed' : 'Mark reviewed',
      onPress: () => {
        actions.onToggleReviewed(file.path, !isReviewed)
      },
    },
    {
      glyph: 'commentAdd',
      id: 'comment',
      label: 'Comment on file',
      onPress: () => {
        actions.onComment(file.path)
      },
    },
  ]
  if (working && file.unstaged === true) {
    menuActions.push({
      glyph: 'plus',
      id: 'stage',
      label: 'Stage',
      onPress: () => {
        actions.onStage(file.path)
      },
    })
  }
  if (working && file.staged === true) {
    menuActions.push({
      glyph: 'minus',
      id: 'unstage',
      label: 'Unstage',
      onPress: () => {
        actions.onUnstage(file.path)
      },
    })
  }
  if (working) {
    menuActions.push({
      destructive: true,
      glyph: 'undo',
      id: 'discard',
      label: 'Discard changes',
      onPress: () => {
        setConfirmDiscard(true)
      },
    })
  }

  return (
    <View>
      <Pressable
        accessibilityLabel={`${file.status} ${file.path}${isReviewed ? ', reviewed' : ''}`}
        accessibilityRole="button"
        accessibilityState={{ selected }}
        className={cn(
          'min-h-14 flex-row items-start gap-2.5',
          SURFACE_ROW,
          selected && SURFACE_ROW_SELECTED,
        )}
        testID={fileRowTestId(file.path)}
        onLongPress={() => {
          setMenuOpen(true)
        }}
        onPress={() => {
          actions.onOpen(file.path)
        }}
      >
        <Text className={cn('mt-0.5 w-3 text-center font-mono text-xs font-bold', badge.className)}>
          {badge.label}
        </Text>
        <View className="min-w-0 flex-1 gap-0.5">
          <View className="flex-row items-center gap-1.5">
            {file.staged === true ? (
              <View
                accessibilityLabel={file.unstaged === true ? 'Partially staged' : 'Staged'}
                className={cn(
                  'size-1.5 shrink-0 rounded-full',
                  file.unstaged === true ? 'bg-warning' : 'bg-success',
                )}
              />
            ) : null}
            {isReviewed ? <ChromeGlyph name="check" size={11} tone="success" /> : null}
            <Text
              className={cn(
                'min-w-0 shrink font-mono text-[13px] text-foreground',
                isReviewed && 'text-muted-foreground line-through',
              )}
              numberOfLines={1}
            >
              {name}
            </Text>
            {file.additions === undefined ? null : (
              <Text className="shrink-0 font-mono text-[10px] text-success">+{file.additions}</Text>
            )}
            {file.deletions === undefined ? null : (
              <Text className="shrink-0 font-mono text-[10px] text-destructive">
                −{file.deletions}
              </Text>
            )}
          </View>
          {directory === '' ? null : (
            // Head-truncated: the tail of a path is what identifies it, the repo root never is.
            <Text
              className="font-mono text-[11px] text-muted-foreground"
              ellipsizeMode="head"
              numberOfLines={1}
            >
              {directory}
            </Text>
          )}
          {connects === '' ? null : (
            <Text className="font-mono text-[11px] text-muted-foreground/70" numberOfLines={1}>
              → {connects}
            </Text>
          )}
        </View>
      </Pressable>

      <ActionSheet
        actions={menuActions}
        open={menuOpen}
        subtitle={file.path}
        testID="porcelain-changes-file-menu"
        title={name}
        onClose={() => {
          setMenuOpen(false)
        }}
      />
      <ConfirmDialog
        body={
          isNew
            ? `This moves the new file “${name}” to the Trash on the daemon host — you can restore it from there.`
            : `This reverts “${name}” to the last commit. Uncommitted changes cannot be recovered.`
        }
        confirmLabel="Discard"
        open={confirmDiscard}
        testID="porcelain-changes-discard-confirm"
        title={`Discard ${name}?`}
        onCancel={() => {
          setConfirmDiscard(false)
        }}
        onConfirm={() => {
          setConfirmDiscard(false)
          actions.onDiscard(file.path)
        }}
      />
    </View>
  )
}

/** Memoized: the flow list re-renders on every 3s poll, and a repo can hold hundreds of rows. */
export const FileRow = memo(FileRowImpl)
