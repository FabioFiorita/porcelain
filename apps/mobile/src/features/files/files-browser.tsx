import { useState } from 'react'
import { FlatList, Pressable, Text, View } from 'react-native'

import { EmptyNote, ErrorNote, IconAction } from '@/components/panel-chrome'
import { type CommentAnchor, CommentComposer } from '@/features/comments/comment-composer'
import { useActiveRepo } from '@/lib/daemon/repo'
import { cn } from '@/lib/utils'
import { type EntryActions, FileEntryRow } from './file-entry-row'
import { breadcrumbs, type Crumb, pathTestId, REPO_ROOT } from './file-paths'
import { useFilesStore } from './files-store'
import { type FileEntry, useDirEntries, usePathScope } from './use-files'

/**
 * One directory, as a list.
 *
 * A drill-down rather than the desktop's expanding tree: indentation costs the width a phone
 * does not have, and a folder you enter is a screen you can swipe back out of. The daemon
 * reads one directory at a time either way, so nothing is paid for the choice.
 *
 * The phone pushes a route per folder and gets the pop gesture; the tablet moves a cursor in
 * the store because its column has no stack. Both render this component.
 */
export function FilesBrowser({
  active,
  bottomInset = 0,
  dirPath,
  onBack,
  onOpenCrumb,
  onOpenDir,
  onOpenFile,
  selectedPath = null,
  topInset,
}: {
  active: boolean
  /** Phone: room for the floating tab bar the list scrolls under. */
  bottomInset?: number
  /** Repo-relative directory; `''` is the repo root. */
  dirPath: string
  /** Phone folder screens: pop back. Omitted at a tab root and on tablet. */
  onBack?: () => void
  /**
   * Tablet: jump straight to an ancestor. Omitted on phone, where the stack already holds
   * every level and the back gesture is the way up — pushing an ancestor would grow the
   * stack going backwards.
   */
  onOpenCrumb?: (path: string) => void
  onOpenDir: (path: string) => void
  onOpenFile: (path: string) => void
  /** Tablet: the file the viewer column is showing. */
  selectedPath?: string | null
  /** Phone folder screens: this view replaces the tab header, so it owns the status bar. */
  topInset?: number
}): React.JSX.Element {
  const repo = useActiveRepo()
  const showHidden = useFilesStore((state) => state.showHidden)
  const toggleHidden = useFilesStore((state) => state.toggleHidden)
  const { entries, error, isLoading } = useDirEntries(dirPath, active)
  const { hide, pin, unhide, unpin } = usePathScope()
  const [anchor, setAnchor] = useState<CommentAnchor | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)

  // Every scope write is a daemon round trip that can fail; report it here instead of letting
  // a long-press action look like it worked.
  const guard = (label: string, run: () => Promise<void>): void => {
    setActionError(null)
    run().catch((cause: unknown) => {
      setActionError(`${label}: ${cause instanceof Error ? cause.message : String(cause)}`)
    })
  }

  const actions: EntryActions = {
    onComment: (path) => {
      setAnchor({ path })
    },
    onOpen: (entry: FileEntry) => {
      if (entry.kind === 'dir') onOpenDir(entry.path)
      else onOpenFile(entry.path)
    },
    onSetHidden: (path, hidden) => {
      guard(hidden ? 'Hide failed' : 'Unhide failed', () => (hidden ? hide(path) : unhide(path)))
    },
    onSetPinned: (path, pinned) => {
      guard(pinned ? 'Pin failed' : 'Unpin failed', () => (pinned ? pin(path) : unpin(path)))
    },
  }

  const dirCount = entries.filter((entry) => entry.kind === 'dir').length
  const fileCount = entries.length - dirCount
  const pending = isLoading && entries.length === 0

  return (
    <View className="flex-1" testID="porcelain-files-browser">
      <BrowserHeader
        crumbs={breadcrumbs(repo?.name ?? 'Repo', dirPath)}
        onBack={onBack}
        onOpenCrumb={onOpenCrumb}
        onToggleHidden={toggleHidden}
        showHidden={showHidden}
        summary={
          pending
            ? 'Reading directory…'
            : `${dirCount} ${dirCount === 1 ? 'folder' : 'folders'} · ${fileCount} ${
                fileCount === 1 ? 'file' : 'files'
              }${showHidden ? ' · hidden shown' : ''}`
        }
        topInset={topInset}
      />

      {actionError === null ? null : (
        <View className="px-3 pb-2">
          <ErrorNote message={actionError} testID="porcelain-files-action-error" />
        </View>
      )}
      {error === null ? null : (
        <View className="px-3 pb-2">
          <ErrorNote message={error.message} testID="porcelain-files-error" />
        </View>
      )}

      {pending ? (
        <Text className="px-3 py-6 text-sm text-muted-foreground" testID="porcelain-files-loading">
          Reading directory…
        </Text>
      ) : entries.length === 0 && error === null ? (
        <EmptyNote
          body={
            showHidden
              ? 'This folder has nothing in it.'
              : 'Everything here is hidden by the repo’s scope, or the folder is empty.'
          }
          testID="porcelain-files-empty"
          title="Nothing to show"
        />
      ) : (
        <FlatList
          contentContainerClassName="gap-0.5 px-2 pb-8"
          contentContainerStyle={{ paddingBottom: bottomInset }}
          data={entries}
          keyExtractor={(entry: FileEntry) => entry.path}
          renderItem={({ item }) => (
            <FileEntryRow actions={actions} entry={item} selected={item.path === selectedPath} />
          )}
          testID={pathTestId('porcelain-files-rows', dirPath)}
        />
      )}

      <CommentComposer
        anchor={anchor}
        testIDPrefix="porcelain-files-comment"
        onClose={() => {
          setAnchor(null)
        }}
      />
    </View>
  )
}

function BrowserHeader({
  crumbs,
  onBack,
  onOpenCrumb,
  onToggleHidden,
  showHidden,
  summary,
  topInset,
}: {
  crumbs: Crumb[]
  onBack?: () => void
  onOpenCrumb?: (path: string) => void
  onToggleHidden: () => void
  showHidden: boolean
  summary: string
  topInset?: number
}): React.JSX.Element {
  return (
    <View
      className={cn('gap-1 px-2 pb-2', topInset === undefined ? 'pt-1' : 'border-b border-border')}
      style={topInset === undefined ? undefined : { paddingTop: topInset + 6 }}
    >
      <View className="flex-row items-center gap-1">
        {onBack === undefined ? null : (
          <IconAction
            accessibilityLabel="Back to the parent folder"
            glyph="chevronLeft"
            testID="porcelain-files-back"
            tone="foreground"
            onPress={onBack}
          />
        )}
        <View className={cn('min-w-0 flex-1', onBack === undefined && 'pl-1')}>
          <Breadcrumbs crumbs={crumbs} onOpenCrumb={onOpenCrumb} />
          <Text className="text-[11px] text-muted-foreground" testID="porcelain-files-summary">
            {summary}
          </Text>
        </View>
        <IconAction
          accessibilityLabel={showHidden ? 'Hide out-of-scope entries' : 'Show hidden entries'}
          glyph={showHidden ? 'eye' : 'eyeOff'}
          selected={showHidden}
          testID="porcelain-files-toggle-hidden"
          tone={showHidden ? 'primary' : 'muted'}
          onPress={onToggleHidden}
        />
      </View>
    </View>
  )
}

/**
 * The path, as a trail. Interactive only where there is no navigation stack to use instead —
 * see `onOpenCrumb`.
 */
function Breadcrumbs({
  crumbs,
  onOpenCrumb,
}: {
  crumbs: Crumb[]
  onOpenCrumb?: (path: string) => void
}): React.JSX.Element {
  const last = crumbs.length - 1
  return (
    <View className="flex-row flex-wrap items-center">
      {crumbs.map((crumb, index) => {
        const current = index === last
        const label = (
          <Text
            className={cn(
              'font-mono text-xs',
              current ? 'font-medium text-foreground' : 'text-muted-foreground',
            )}
            numberOfLines={1}
          >
            {crumb.label}
          </Text>
        )
        return (
          <View
            key={crumb.path === REPO_ROOT ? 'root' : crumb.path}
            className="flex-row items-center"
          >
            {index === 0 ? null : (
              <Text className="px-0.5 font-mono text-xs text-muted-foreground/60">/</Text>
            )}
            {onOpenCrumb === undefined || current ? (
              label
            ) : (
              <Pressable
                accessibilityLabel={`Go to ${crumb.label}`}
                accessibilityRole="button"
                className="rounded px-0.5 active:bg-accent"
                testID={pathTestId('porcelain-files-crumb', crumb.path)}
                onPress={() => {
                  onOpenCrumb(crumb.path)
                }}
              >
                {label}
              </Pressable>
            )}
          </View>
        )
      })}
    </View>
  )
}
