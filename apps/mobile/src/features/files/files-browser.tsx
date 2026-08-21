import { Pressable, Text, View } from 'react-native'

import {
  ActionSheet,
  ConfirmDialog,
  EmptyNote,
  ErrorNote,
  IconAction,
} from '@/components/panel-chrome'
import { SURFACE_TOOLBAR } from '@/components/surface-layout'
import { SurfaceList } from '@/components/surface-scroll'
import { CommentComposer } from '@/features/comments'
import { useActiveProject } from '@/features/projects'
import { cn } from '@/lib/utils'
import { FileEntryRow } from './file-entry-row'
import { breadcrumbs, type Crumb, pathTestId, REPO_ROOT } from './file-paths'
import type { FileEntry } from './files-data'
import { useFilesStore } from './files-store'
import { NamePrompt } from './name-prompt'
import { useFilesBrowser } from './use-files-browser'

/**
 * One directory, as a list.
 *
 * A drill-down rather than the desktop's expanding tree: indentation costs the width a phone
 * does not have, and a folder you enter is a screen you can swipe back out of. The daemon
 * reads one directory at a time either way, so nothing is paid for the choice.
 *
 * The phone pushes a route per folder and gets the pop gesture; the tablet moves a cursor in
 * the store because its column has no stack. Both render this component.
 *
 * What is in the directory, and what the reader is in the middle of doing to it, is
 * `use-files-browser.ts`; this file is the markup.
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
  /** Repo-relative directory; `''` is the project root. */
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
  const project = useActiveProject()
  const showHidden = useFilesStore((state) => state.showHidden)
  const toggleHidden = useFilesStore((state) => state.toggleHidden)
  const browser = useFilesBrowser({ active, dirPath, onOpenDir, onOpenFile, showHidden })
  const { pending, writes } = browser

  return (
    <View className="flex-1" testID="porcelain-files-browser">
      <BrowserHeader
        crumbs={breadcrumbs(project?.name ?? 'Repo', dirPath)}
        onBack={onBack}
        onNew={() => {
          browser.setNewMenuOpen(true)
        }}
        onOpenCrumb={onOpenCrumb}
        onToggleHidden={toggleHidden}
        showHidden={showHidden}
        summary={browser.summary}
        topInset={topInset}
      />

      {browser.actionError === null ? null : (
        <View className="px-4 pb-2">
          <ErrorNote message={browser.actionError} testID="porcelain-files-action-error" />
        </View>
      )}
      {browser.error === null ? null : (
        <View className="px-4 pb-2">
          <ErrorNote message={browser.error.message} testID="porcelain-files-error" />
        </View>
      )}

      {browser.reading ? (
        <Text className="px-4 py-6 text-sm text-muted-foreground" testID="porcelain-files-loading">
          Reading directory…
        </Text>
      ) : browser.entries.length === 0 && browser.error === null ? (
        <EmptyNote
          body={
            showHidden
              ? 'This folder has nothing in it.'
              : 'Everything here is hidden by the project’s scope, or the folder is empty.'
          }
          testID="porcelain-files-empty"
          title="Nothing to show"
        />
      ) : (
        <SurfaceList
          data={browser.entries}
          edgeToEdge
          gap={2}
          keyExtractor={(entry: FileEntry) => entry.path}
          renderItem={({ item }) => (
            <FileEntryRow
              actions={browser.actions}
              entry={item}
              selected={item.path === selectedPath}
            />
          )}
          testID={pathTestId('porcelain-files-rows', dirPath)}
        />
      )}

      <CommentComposer
        anchor={browser.anchor}
        testIDPrefix="porcelain-files-comment"
        onClose={browser.clearAnchor}
      />

      <ActionSheet
        actions={browser.newActions}
        open={browser.newMenuOpen}
        subtitle={dirPath === REPO_ROOT ? project?.name : dirPath}
        testID="porcelain-files-new-menu"
        title="New"
        onClose={() => {
          browser.setNewMenuOpen(false)
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
            ? `In ${pending.dir === REPO_ROOT ? (project?.name ?? 'the project root') : pending.dir}.`
            : ''
        }
        open={pending?.kind === 'create-file'}
        testID="porcelain-files-new-file-prompt"
        title="New file"
        onClose={browser.closePending}
        onSubmit={(name) => {
          // NamePrompt attaches .then(onClose).catch(error) — return the write Promise, no async JSX.
          if (pending?.kind !== 'create-file') return Promise.resolve()
          return writes.createFile(pending.dir, name)
        }}
      />

      <NamePrompt
        key={`create-folder:${pending?.kind === 'create-folder' ? pending.dir : ''}`}
        busy={writes.isPending}
        confirmLabel="Create"
        description={
          pending?.kind === 'create-folder'
            ? `In ${pending.dir === REPO_ROOT ? (project?.name ?? 'the project root') : pending.dir}.`
            : ''
        }
        open={pending?.kind === 'create-folder'}
        testID="porcelain-files-new-folder-prompt"
        title="New folder"
        onClose={browser.closePending}
        onSubmit={(name) => {
          if (pending?.kind !== 'create-folder') return Promise.resolve()
          return writes.createFolder(pending.dir, name)
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
        onClose={browser.closePending}
        onSubmit={(name) => {
          if (pending?.kind !== 'rename') return Promise.resolve()
          return writes.rename(pending.path, name)
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
        title="Move to Trash?"
        onCancel={browser.closePending}
        onConfirm={() => {
          if (pending?.kind !== 'trash') return
          const { name, path } = pending
          browser.closePending()
          browser.guard(`Could not trash “${name}”`, () => writes.trash(path))
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
          <Text className="text-2xs text-muted-foreground" testID="porcelain-files-summary">
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
