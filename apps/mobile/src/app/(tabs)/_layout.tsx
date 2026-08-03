import { NativeTabs } from 'expo-router/unstable-native-tabs'
import { Platform } from 'react-native'

import type { TabWithAlternate } from '@/lib/tab-alternates'
import { useTabFaces } from '@/lib/tab-faces'
import { useTabRootFocus } from '@/lib/tab-root-focus'
import { useAccentColor } from '@/theme/colors'

/**
 * iPhone shell: four tab slots. Files, Changes, and Review are dual-face — re-tap the
 * focused root toggles Search / History / Board. Face state is not URL-based, so chrome
 * sheets leave the tab bar identity alone.
 */
export default function TabsLayout(): React.JSX.Element {
  const accentColor = useAccentColor()
  const hideBar = 'isPad' in Platform && Platform.isPad
  const filesFace = useTabFaces((state) => state.files)
  const changesFace = useTabFaces((state) => state.changes)
  const reviewFace = useTabFaces((state) => state.review)

  return (
    <NativeTabs hidden={hideBar} minimizeBehavior="onScrollDown" tintColor={accentColor}>
      <NativeTabs.Trigger
        listeners={{
          tabPress: (): void => {
            toggleFaceIfRoot('files')
          },
        }}
        name="(files)"
      >
        <NativeTabs.Trigger.Icon sf={filesFace === 'search' ? 'magnifyingglass' : 'folder.fill'} />
        <NativeTabs.Trigger.Label>
          {filesFace === 'search' ? 'Search' : 'Files'}
        </NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>
      <NativeTabs.Trigger
        listeners={{
          tabPress: (): void => {
            toggleFaceIfRoot('changes')
          },
        }}
        name="(changes)"
      >
        <NativeTabs.Trigger.Icon
          sf={changesFace === 'history' ? 'clock.arrow.circlepath' : 'arrow.triangle.branch'}
        />
        <NativeTabs.Trigger.Label>
          {changesFace === 'history' ? 'History' : 'Changes'}
        </NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>
      <NativeTabs.Trigger
        listeners={{
          tabPress: (): void => {
            toggleFaceIfRoot('review')
          },
        }}
        name="(review)"
      >
        <NativeTabs.Trigger.Icon
          sf={reviewFace === 'board' ? 'rectangle.3.group.fill' : 'checkmark.seal.fill'}
        />
        <NativeTabs.Trigger.Label>
          {reviewFace === 'board' ? 'Board' : 'Review'}
        </NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="(terminal)">
        <NativeTabs.Trigger.Icon sf="terminal.fill" />
        <NativeTabs.Trigger.Label>Terminal</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>
    </NativeTabs>
  )
}

function toggleFaceIfRoot(tab: TabWithAlternate): void {
  if (!useTabRootFocus.getState().roots[tab]) return
  if (tab === 'files') useTabFaces.getState().toggleFiles()
  else if (tab === 'changes') useTabFaces.getState().toggleChanges()
  else useTabFaces.getState().toggleReview()
}
