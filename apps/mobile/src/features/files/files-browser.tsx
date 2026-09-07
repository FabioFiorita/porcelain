import { useCallback, useRef } from 'react'
import { LayoutAnimation, Pressable, ScrollView, Text, View } from 'react-native'
import { ChromeGlyph } from '@/components/chrome-glyph'
import type { SheetAction } from '@/components/panel-chrome'
import {
  ActionSheet,
  ConfirmDialog,
  EmptyNote,
  ErrorNote,
  ICON_ACTION,
  IconAction,
} from '@/components/panel-chrome'
import { SURFACE_TOOLBAR } from '@/components/surface-layout'
import { SurfaceList } from '@/components/surface-scroll'
import { AnchoredMenu } from '@/components/ui/row-context-menu'
import { CommentComposer } from '@/features/comments'
import { useActiveProject } from '@/features/projects'
import { useIsTablet } from '@/features/shell/use-app-window'
import { useTopChrome } from '@/features/shell/window-chrome'
import { cn } from '@/lib/utils'
import { FileEntryRow } from './file-entry-row'
import { breadcrumbs, type Crumb, pathTestId, REPO_ROOT } from './file-paths'
import { type FileEntry, usePinnedEntries } from './files-data'
import { useFilesStore } from './files-store'
import { FilesTree } from './files-tree'
import { NamePrompt } from './name-prompt'
import { useFilesBrowser } from './use-files-browser'

/**
 * One directory, as a list.
 *
 * It can render either a directory route or the persistent lazy tree shared by the main phone
 * and tablet Files surfaces. Directory mode remains for a folder opened from another surface;
 * tree mode keeps the same context actions and write dialogs while expanding folders in place.
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
  tree = false,
  includePinned = false,
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
  /** The active or most recently opened file to highlight and reveal in the tree. */
  selectedPath?: string | null
  /** Persistent, lazy expansion matching the web/tablet Files rail. */
  tree?: boolean
  includePinned?: boolean
  /** Phone folder screens: this view replaces the tab header, so it owns the status bar. */
}): React.JSX.Element {
  const project = useActiveProject()
  const showHidden = useFilesStore((state) => state.showHidden)
  const toggleHidden = useFilesStore((state) => state.toggleHidden)
  const collapseAll = useFilesStore((state) => state.collapseAll)
  const collapseNonce = useFilesStore((state) => state.collapseNonce)
  const browser = useFilesBrowser({ active, dirPath, onOpenDir, onOpenFile, showHidden })
  const { pending, writes } = browser
  const pins = usePinnedEntries(active && includePinned)
  const scrollRef = useRef<ScrollView>(null)
  const scrollOffset = useRef(0)
  const selectedCount = useFilesStore((s) => s.selectedPaths.length)
  const revealRow = useCallback((row: View) => {
    row.measureInWindow((_x, rowY) => {
      scrollRef.current?.getNativeScrollRef()?.measureInWindow((_sx: number, scrollY: number) => {
        scrollRef.current?.scrollTo({
          y: Math.max(0, scrollOffset.current + rowY - scrollY - 8),
          animated: true,
        })
      })
    })
  }, [])

  const header = (
    <BrowserHeader
      crumbs={breadcrumbs(project?.name ?? 'Repo', dirPath)}
      tree={tree}
      onCollapseAll={() => {
        LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut)
        collapseAll()
      }}
      onBack={onBack}
      onNew={() => {
        browser.setNewMenuOpen(true)
      }}
      onOpenCrumb={onOpenCrumb}
      onToggleHidden={() => {
        LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut)
        toggleHidden()
      }}
      showHidden={showHidden}
      summary={browser.summary}
      newActions={browser.newActions}
      onReveal={
        tree && selectedPath
          ? () => {
              useFilesStore.setState({ showHidden: true })
              useFilesStore.getState().reveal(selectedPath)
            }
          : undefined
      }
    />
  )
  const loading = (
    <Text className="px-4 py-6 text-sm text-muted-foreground" testID="porcelain-files-loading">
      Reading directory…
    </Text>
  )
  const empty = (
    <View>
      <EmptyNote
        body={
          showHidden
            ? 'This folder has nothing in it.'
            : 'Everything here is hidden by the project’s scope, or the folder is empty.'
        }
        testID="porcelain-files-empty"
        title="Nothing to show"
      />
      <View className="flex-row flex-wrap gap-2 px-4 pb-4">
        {browser.newActions.map((action) => (
          <Pressable
            key={action.id}
            onPress={action.onPress}
            testID={`porcelain-files-empty-${action.id}`}
            accessibilityRole="button"
            className="rounded-lg border border-border px-3 py-2 active:bg-accent"
          >
            <Text className="text-xs text-foreground">{action.label}</Text>
          </Pressable>
        ))}
      </View>
    </View>
  )

  return (
    <View className="flex-1" testID="porcelain-files-browser">
      {!tree && header}

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

      {tree ? (
        <ScrollView
          ref={scrollRef}
          onScroll={(event) => {
            scrollOffset.current = event.nativeEvent.contentOffset.y
          }}
          scrollEventThrottle={16}
          className="min-h-0 flex-1"
          contentInsetAdjustmentBehavior="never"
        >
          {includePinned && (
            <View testID="porcelain-files-pinned" className="border-b border-border pb-2 mb-2">
              <Text className="px-4 py-2 text-2xs font-bold uppercase text-muted-foreground">
                Pinned
              </Text>
              {pins.error ? (
                <ErrorNote message={pins.error.message} testID="porcelain-files-pins-error" />
              ) : pins.isLoading ? (
                <Text className="px-4 text-xs text-muted-foreground">Reading pins…</Text>
              ) : pins.entries.length === 0 ? (
                <Text className="px-4 text-xs text-muted-foreground">
                  Pin a file or folder from its menu.
                </Text>
              ) : (
                <FilesTree
                  actions={browser.actions}
                  active={active}
                  collapseNonce={collapseNonce}
                  entries={pins.entries}
                  onOpenFile={onOpenFile}
                  selectedPath={selectedPath}
                />
              )}
            </View>
          )}
          {header}
          {selectedCount > 0 && (
            <View className="flex-row items-center justify-between px-4">
              <Text className="text-xs text-muted-foreground">{selectedCount} selected</Text>
              <IconAction
                glyph="close"
                accessibilityLabel="Clear selection"
                testID="porcelain-files-clear-selection"
                onPress={() => useFilesStore.getState().clearSelection()}
              />
            </View>
          )}
          {browser.reading ? (
            loading
          ) : browser.entries.length === 0 && browser.error === null ? (
            empty
          ) : (
            <FilesTree
              actions={browser.actions}
              active={active}
              collapseNonce={collapseNonce}
              entries={browser.entries}
              onReveal={revealRow}
              onOpenFile={onOpenFile}
              selectedPath={selectedPath}
            />
          )}
        </ScrollView>
      ) : browser.reading ? (
        loading
      ) : browser.entries.length === 0 && browser.error === null ? (
        empty
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
  tree,
  onCollapseAll,
  newActions,
  onReveal,
}: {
  crumbs: Crumb[]
  onBack?: () => void
  /** Create in the directory on screen — the affordance an empty folder has no row for. */
  onNew: () => void
  onOpenCrumb?: (path: string) => void
  onToggleHidden: () => void
  showHidden: boolean
  summary: string
  tree: boolean
  onCollapseAll: () => void
  newActions: SheetAction[]
  onReveal?: () => void
}): React.JSX.Element {
  // This toolbar doubles as the screen header on the routes where the breadcrumb IS the title.
  // A non-zero inset is the shell saying "you are at the top of the window", which is also when
  // the band owes a hairline to whatever scrolls under it.
  const topInset = useTopChrome()
  const tablet = useIsTablet()

  return (
    <View
      className={cn(SURFACE_TOOLBAR, 'gap-1', topInset > 0 && 'border-b border-border')}
      /* nativewind-allow-style: the band clears the live status-bar inset when it owns it. */
      style={topInset > 0 ? { paddingTop: topInset + 6 } : undefined}
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
          {tree ? (
            <Text className="text-2xs font-bold uppercase tracking-wider text-muted-foreground">
              All Files
            </Text>
          ) : (
            <>
              <Breadcrumbs crumbs={crumbs} onOpenCrumb={onOpenCrumb} />
              <Text className="text-2xs text-muted-foreground" testID="porcelain-files-summary">
                {summary}
              </Text>
            </>
          )}
        </View>
        <View className="-mr-2 flex-row items-center">
          {onReveal && (
            <IconAction
              glyph="locate"
              accessibilityLabel="Reveal active file"
              testID="porcelain-files-reveal-active"
              onPress={onReveal}
            />
          )}
          {tree ? (
            <IconAction
              accessibilityLabel="Collapse all folders"
              glyph="chevronUp"
              testID="porcelain-files-collapse-all"
              onPress={onCollapseAll}
            />
          ) : null}
          {tablet ? (
            <AnchoredMenu actions={newActions} testID="porcelain-files-new" title="Create">
              <Pressable
                accessibilityLabel="Create file or folder"
                accessibilityRole="button"
                testID="porcelain-files-new-button"
                className={ICON_ACTION}
              >
                <ChromeGlyph name="plus" size={17} tone="muted" />
              </Pressable>
            </AnchoredMenu>
          ) : (
            <IconAction
              accessibilityLabel="New file or folder here"
              glyph="plus"
              testID="porcelain-files-new"
              tone="foreground"
              onPress={onNew}
            />
          )}
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
