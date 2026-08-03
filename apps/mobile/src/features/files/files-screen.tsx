import { ObserveInteractiveMarker } from 'expo-observe'
import { Stack } from 'expo-router'
import { useCallback, useEffect } from 'react'
import { Platform } from 'react-native'

import { DaemonGate } from '@/components/daemon-gate'
import { IPadDetailPlaceholder } from '@/components/ipad-detail-placeholder'
import { ScreenHeader } from '@/components/screen-header'
import { toolbarIcon } from '@/components/toolbar-icon'
import { useSurfaceFocus } from '@/components/use-surface-focus'
import { useActiveRepo } from '@/lib/daemon/repo'
import { useIPadDestination } from '@/lib/ipad-destination'
import { setPreference, usePreferences } from '@/lib/preferences'
import { FileTree } from './file-tree'
import { FilesLoading } from './files-empty-states'
import { useFileTreeStore } from './use-file-tree'

function isIPad(): boolean {
  return 'isPad' in Platform && Platform.isPad
}

/**
 * Files browse face — directory listing with the same header chrome as every other tab root.
 * Search is the re-tap face (`FilesSearchScreen`), not a nav-bar search field.
 * On iPad the listing lives in the SplitView supplementary column.
 */
export function FilesScreen(): React.JSX.Element {
  const preferences = usePreferences()
  const repo = useActiveRepo()
  useSurfaceFocus('files')
  useEffect(() => {
    if (isIPad()) useIPadDestination.getState().setDestination('files')
  }, [])
  const collapseAll = useCallback((): void => {
    if (repo !== null) useFileTreeStore.getState().collapseAll(repo.path)
  }, [repo])

  return (
    <>
      {isIPad() ? (
        <IPadDetailPlaceholder
          description="Choose a file from the list to open it."
          title="Select a file"
        />
      ) : (
        <DaemonGate requires="repo">
          <FilesBrowse />
        </DaemonGate>
      )}
      <ScreenHeader title="Files" />
      {/* Same right toolbar as ScreenHeader — Menu merges into the trailing cluster on iOS 26. */}
      {!isIPad() ? (
        <Stack.Toolbar placement="right">
          <Stack.Toolbar.Menu accessibilityLabel="Files options" icon={toolbarIcon('more')}>
            <Stack.Toolbar.MenuAction
              icon={preferences.filesShowHidden ? 'eye.slash' : 'eye'}
              isOn={preferences.filesShowHidden}
              onPress={(): void => setPreference('filesShowHidden', !preferences.filesShowHidden)}
            >
              {preferences.filesShowHidden ? 'Hide hidden files' : 'Show hidden files'}
            </Stack.Toolbar.MenuAction>
            <Stack.Toolbar.MenuAction
              icon="arrow.down.right.and.arrow.up.left"
              onPress={collapseAll}
            >
              Collapse all
            </Stack.Toolbar.MenuAction>
          </Stack.Toolbar.Menu>
        </Stack.Toolbar>
      ) : null}
      <ObserveInteractiveMarker />
    </>
  )
}

/** The real tree used by the root SplitView supplementary column on iPad. */
export function FilesSplitColumn(): React.JSX.Element {
  return (
    <DaemonGate requires="repo">
      <FilesBrowse />
    </DaemonGate>
  )
}

function FilesBrowse(): React.JSX.Element {
  const repo = useActiveRepo()
  const preferences = usePreferences()

  if (repo === null) return <FilesLoading />

  // The tree draws itself on the row canvas — do not wrap it in a Host or List, or it collapses
  // to zero height the way the old FlatList listing did.
  return (
    <FileTree
      repoPath={repo.path}
      rootPath={repo.path}
      showHidden={preferences.filesShowHidden}
      showPinned
    />
  )
}
