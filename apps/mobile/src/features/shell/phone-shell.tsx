import { NativeTabs } from 'expo-router/unstable-native-tabs'

import { useChangedFileCount } from '@/features/changes/use-changes'

import { ShellSheets } from './shell-sheets'
import type { DualTabSlot } from './tab-faces'
import { useTabFaces } from './tab-faces'
import { useTabRootFocus } from './tab-root-focus'

/**
 * Phone outer shell — five tabs; Files / Changes / Review are dual-face.
 * Face state is store-driven so sheets never reset the tab bar identity.
 * Settings is a tab (not a gear). Bolt companion is a sheet from the header.
 */
export function PhoneShell(): React.JSX.Element {
  const filesFace = useTabFaces((state) => state.files)
  const changesFace = useTabFaces((state) => state.changes)
  const reviewFace = useTabFaces((state) => state.review)
  // The badge is the live working-tree count — a fixed number here would be a lie the moment
  // the agent writes anything.
  const changedFiles = useChangedFileCount()

  return (
    <>
      <NativeTabs
        disableTransparentOnScrollEdge
        minimizeBehavior="onScrollDown"
        tintColor="#0A84FF"
      >
        {/* The Files tab is a route group, so its stack (`/folder/…`, `/file/…`) lives inside
            the tab while the tab root stays the app's `/`. */}
        <NativeTabs.Trigger
          name="(files)"
          listeners={{
            tabPress: () => {
              toggleFaceIfRoot('files')
            },
          }}
        >
          <NativeTabs.Trigger.Icon
            sf={filesFace === 'search' ? 'magnifyingglass' : 'folder.fill'}
            md={filesFace === 'search' ? 'search' : 'folder'}
          />
          <NativeTabs.Trigger.Label>
            {filesFace === 'search' ? 'Search' : 'Files'}
          </NativeTabs.Trigger.Label>
        </NativeTabs.Trigger>

        <NativeTabs.Trigger
          name="changes"
          listeners={{
            tabPress: () => {
              toggleFaceIfRoot('changes')
            },
          }}
        >
          <NativeTabs.Trigger.Icon
            sf={changesFace === 'history' ? 'clock.arrow.circlepath' : 'arrow.triangle.branch'}
            md={changesFace === 'history' ? 'history' : 'account_tree'}
          />
          <NativeTabs.Trigger.Label>
            {changesFace === 'history' ? 'History' : 'Changes'}
          </NativeTabs.Trigger.Label>
          {changesFace === 'changes' && changedFiles > 0 ? (
            <NativeTabs.Trigger.Badge>{String(changedFiles)}</NativeTabs.Trigger.Badge>
          ) : null}
        </NativeTabs.Trigger>

        <NativeTabs.Trigger
          name="review"
          listeners={{
            tabPress: () => {
              toggleFaceIfRoot('review')
            },
          }}
        >
          <NativeTabs.Trigger.Icon
            sf={reviewFace === 'board' ? 'rectangle.split.3x1.fill' : 'checkmark.bubble.fill'}
            md={reviewFace === 'board' ? 'view_kanban' : 'rate_review'}
          />
          <NativeTabs.Trigger.Label>
            {reviewFace === 'board' ? 'Board' : 'Review'}
          </NativeTabs.Trigger.Label>
        </NativeTabs.Trigger>

        <NativeTabs.Trigger name="terminal">
          <NativeTabs.Trigger.Icon sf="terminal.fill" md="terminal" />
          <NativeTabs.Trigger.Label>Terminal</NativeTabs.Trigger.Label>
        </NativeTabs.Trigger>

        <NativeTabs.Trigger name="settings">
          <NativeTabs.Trigger.Icon sf="gearshape.fill" md="settings" />
          <NativeTabs.Trigger.Label>Settings</NativeTabs.Trigger.Label>
        </NativeTabs.Trigger>
      </NativeTabs>
      <ShellSheets variant="phone" />
    </>
  )
}

function toggleFaceIfRoot(tab: DualTabSlot): void {
  // Re-tapping a tab pops its stack to the root first (the iOS "back to root" idiom) — the
  // navigator does that itself, so a tab only reaches here once it is already showing its
  // list, and the tap means "flip to the alternate face".
  if (!useTabRootFocus.getState().roots[tab]) return
  if (tab === 'files') useTabFaces.getState().toggleFiles()
  else if (tab === 'changes') useTabFaces.getState().toggleChanges()
  else useTabFaces.getState().toggleReview()
}
