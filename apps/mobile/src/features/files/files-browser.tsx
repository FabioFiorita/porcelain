import { useState } from 'react'
import { Pressable, Text, View } from 'react-native'

import {
  ActionSheet,
  ConfirmDialog,
  EmptyNote,
  ErrorNote,
  IconAction,
  type SheetAction,
} from '@/components/panel-chrome'
import { SURFACE_TOOLBAR } from '@/components/surface-layout'
import { SurfaceList } from '@/components/surface-scroll'
import { type CommentAnchor, CommentComposer } from '@/features/comments/comment-composer'
import { useActiveRepo } from '@/lib/daemon/repo'
import { cn } from '@/lib/utils'
import { type EntryActions, FileEntryRow } from './file-entry-row'
import { breadcrumbs, type Crumb, parentPath, pathTestId, REPO_ROOT } from './file-paths'
import { useFilesStore } from './files-store'
import { NamePrompt } from './name-prompt'
import { type FileEntry, useDirEntries, useFileWrites, usePathScope } from './use-files'

/**
 * The write the tree is in the middle of asking about.
 *
 * One at a time, held by the browser rather than by the row: a prompt per row would put a
 * hundred modals in a directory listing, and only one of them can ever be on screen.
 */
type PendingWrite =
  | { kind: 'create-file'; dir: string }
  | { kind: 'create-folder'; dir: string }
  | { kind: 'rename'; path: string; name: string }
  | { kind: 'trash'; path: string; name: string }

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
  dirPath,
  onBack,
  onOpenCrumb,
  onOpenDir,
  onOpenFile,
  selectedPath = null,
  topInset,
}: {
  active: boolean
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
  const writes = useFileWrites()
  const [anchor, setAnchor] = useState<CommentAnchor | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)
  const [pending, setPending] = useState<PendingWrite | null>(null)
  const [newMenuOpen, setNewMenuOpen] = useState(false)

  // Every scope write is a daemon round trip that can fail; report it here instead of letting
  // a long-press action look like it worked.
  const guard = (label: string, run: () => Promise<void>): void => {
    setActionError(null)
    run().catch((cause: unknown) => {
      setActionError(`${label}: ${cause instanceof Error ? cause.message : String(cause)}`)
    })
  }

  /** A new entry lands inside a folder row, and beside a file row. */
  const containerFor = (entry: FileEntry): string =>
    entry.kind === 'dir' ? entry.path : parentPath(entry.path)

  const actions: EntryActions = {
    onComment: (path) => {
      setAnchor({ path })
    },
    onCreateFile: (entry) => {
      setActionError(null)
      setPending({ dir: containerFor(entry), kind: 'create-file' })
    },
    onCreateFolder: (entry) => {
      setActionError(null)
      setPending({ dir: containerFor(entry), kind: 'create-folder' })
    },
    onDuplicate: (entry) => {
      guard('Duplicate failed', async () => {
        await writes.duplicate(entry.path)
      })
    },
    onOpen: (entry: FileEntry) => {
      if (entry.kind === 'dir') onOpenDir(entry.path)
      else onOpenFile(entry.path)
    },
    onRename: (entry) => {
      setActionError(null)
      setPending({ kind: 'rename', name: entry.name, path: entry.path })
    },
    onSetHidden: (path, hidden) => {
      guard(hidden ? 'Hide failed' : 'Unhide failed', () => (hidden ? hide(path) : unhide(path)))
    },
    onSetPinned: (path, pinned) => {
      guard(pinned ? 'Pin failed' : 'Unpin failed', () => (pinned ? pin(path) : unpin(path)))
    },
    onTrash: (entry) => {
      setActionError(null)
      setPending({ kind: 'trash', name: entry.name, path: entry.path })
    },
  }

  // The header's own "New", for the case a long press cannot reach: an empty folder has no row
  // to press, and the repo root has no parent row either.
  const newActions: SheetAction[] = [
    {
      glyph: 'plus',
      id: 'new-file',
      label: 'New file',
      onPress: () => {
        setActionError(null)
        setPending({ dir: dirPath, kind: 'create-file' })
      },
    },
    {
      glyph: 'folder',
      id: 'new-folder',
      label: 'New folder',
      onPress: () => {
        setActionError(null)
        setPending({ dir: dirPath, kind: 'create-folder' })
      },
    },
  ]

  const closePending = (): void => {
    setPending(null)
  }

  const dirCount = entries.filter((entry) => entry.kind === 'dir').length
  const fileCount = entries.length - dirCount
  const reading = isLoading && entries.length === 0

  return (
    <View className="flex-1" testID="porcelain-files-browser">
      <BrowserHeader
        crumbs={breadcrumbs(repo?.name ?? 'Repo', dirPath)}
        onBack={onBack}
        onNew={() => {
          setNewMenuOpen(true)
        }}
        onOpenCrumb={onOpenCrumb}
        onToggleHidden={toggleHidden}
        showHidden={showHidden}
        summary={
          reading
            ? 'Reading directory…'
            : `${dirCount} ${dirCount === 1 ? 'folder' : 'folders'} · ${fileCount} ${
                fileCount === 1 ? 'file' : 'files'
              }${showHidden ? ' · hidden shown' : ''}`
        }
        topInset={topInset}
      />

      {actionError === null ? null : (
        <View className="px-4 pb-2">
          <ErrorNote message={actionError} testID="porcelain-files-action-error" />
        </View>
      )}
      {error === null ? null : (
        <View className="px-4 pb-2">
          <ErrorNote message={error.message} testID="porcelain-files-error" />
        </View>
      )}

      {reading ? (
        <Text className="px-4 py-6 text-sm text-muted-foreground" testID="porcelain-files-loading">
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
        <SurfaceList
          data={entries}
          edgeToEdge
          gap={2}
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

      <ActionSheet
        actions={newActions}
        open={newMenuOpen}
        subtitle={dirPath === REPO_ROOT ? repo?.name : dirPath}
        testID="porcelain-files-new-menu"
        title="New"
        onClose={() => {
          setNewMenuOpen(false)
        }}
      />

      {/* Remounted per pending write (the key), so the field opens on this row's name rather
          than on the last one's. */}
      <NamePrompt
        key={`create-file:${pending?.kind === 'create-file' ? pending.dir : ''}`}
        busy={writes.isPending}
        confirmLabel="Create"
        description={
          pending?.kind === 'create-file'
            ? `In ${pending.dir === REPO_ROOT ? (repo?.name ?? 'the repo root') : pending.dir}.`
            : ''
        }
        open={pending?.kind === 'create-file'}
        testID="porcelain-files-new-file-prompt"
        title="New file"
        onClose={closePending}
        onSubmit={async (name) => {
          if (pending?.kind !== 'create-file') return
          await writes.createFile(pending.dir, name)
        }}
      />

      <NamePrompt
        key={`create-folder:${pending?.kind === 'create-folder' ? pending.dir : ''}`}
        busy={writes.isPending}
        confirmLabel="Create"
        description={
          pending?.kind === 'create-folder'
            ? `In ${pending.dir === REPO_ROOT ? (repo?.name ?? 'the repo root') : pending.dir}.`
            : ''
        }
        open={pending?.kind === 'create-folder'}
        testID="porcelain-files-new-folder-prompt"
        title="New folder"
        onClose={closePending}
        onSubmit={async (name) => {
          if (pending?.kind !== 'create-folder') return
          await writes.createFolder(pending.dir, name)
        }}
      />

      <NamePrompt
        key={`rename:${pending?.kind === 'rename' ? pending.path : ''}`}
        busy={writes.isPending}
        confirmLabel="Rename"
        description={pending?.kind === 'rename' ? pending.path : ''}
        initialValue={pending?.kind === 'rename' ? pending.name : ''}
        open={pending?.kind === 'rename'}
        testID="porcelain-files-rename-prompt"
        title="Rename"
        onClose={closePending}
        onSubmit={async (name) => {
          if (pending?.kind !== 'rename') return
          await writes.rename(pending.path, name)
        }}
      />

      {/* "Trash", not "Delete": the daemon moves the path to the OS trash, and a dialog that
          says Delete promises something worse than what happens. */}
      <ConfirmDialog
        body={
          pending?.kind === 'trash'
            ? `“${pending.name}” moves to the Trash on the host. ${pending.path}`
            : ''
        }
        confirmLabel="Trash"
        open={pending?.kind === 'trash'}
        testID="porcelain-files-trash-confirm"
        title="Move to Trash?"
        onCancel={closePending}
        onConfirm={() => {
          if (pending?.kind !== 'trash') return
          const { name, path } = pending
          closePending()
          guard(`Could not trash “${name}”`, () => writes.trash(path))
        }}
      />
    </View>
  )
}

function BrowserHeader({
  crumbs,
  onBack,
  onNew,
  onOpenCrumb,
  onToggleHidden,
  showHidden,
  summary,
  topInset,
}: {
  crumbs: Crumb[]
  onBack?: () => void
  /** Create in the directory on screen — the affordance an empty folder has no row for. */
  onNew: () => void
  onOpenCrumb?: (path: string) => void
  onToggleHidden: () => void
  showHidden: boolean
  summary: string
  topInset?: number
}): React.JSX.Element {
  return (
    <View
      className={cn(
        SURFACE_TOOLBAR,
        'gap-1',
        topInset === undefined ? undefined : 'border-b border-border',
      )}
      style={topInset === undefined ? undefined : { paddingTop: topInset + 6 }}
    >
      {/* The icon clusters hang half an icon button outside the gutter so their glyphs, not
          their 36pt hit boxes, line up with the breadcrumb and the rows below. */}
      <View className="flex-row items-center gap-1">
        {onBack === undefined ? null : (
          <View className="-ml-2">
            <IconAction
              accessibilityLabel="Back to the parent folder"
              glyph="chevronLeft"
              testID="porcelain-files-back"
              tone="foreground"
              onPress={onBack}
            />
          </View>
        )}
        <View className="min-w-0 flex-1">
          <Breadcrumbs crumbs={crumbs} onOpenCrumb={onOpenCrumb} />
          <Text className="text-[11px] text-muted-foreground" testID="porcelain-files-summary">
            {summary}
          </Text>
        </View>
        <View className="-mr-2 flex-row items-center">
          <IconAction
            accessibilityLabel="New file or folder here"
            glyph="plus"
            testID="porcelain-files-new"
            tone="foreground"
            onPress={onNew}
          />
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
