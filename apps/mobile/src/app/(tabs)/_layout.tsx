import { router } from 'expo-router'
import { NativeTabs } from 'expo-router/unstable-native-tabs'
import { Platform } from 'react-native'

import { TAB_ALTERNATES, type TabWithAlternate } from '@/lib/tab-alternates'
import { useTabRootFocus } from '@/lib/tab-root-focus'
import { useAccentColor } from '@/theme/colors'

/**
 * iPhone shell: four primary destinations. History and Board are alternates of Changes and
 * Review — re-tap the already-focused tab root to open them (NativeTabs has no long-press
 * menu API). Header actions on those tabs mirror the same destinations. Settings and
 * Companion are chrome sheets. iPad hides this bar; SplitView owns navigation there.
 */
export default function TabsLayout(): React.JSX.Element {
  const accentColor = useAccentColor()
  const hideBar = 'isPad' in Platform && Platform.isPad

  return (
    <NativeTabs hidden={hideBar} minimizeBehavior="onScrollDown" tintColor={accentColor}>
      <NativeTabs.Trigger name="(files)">
        <NativeTabs.Trigger.Icon sf="folder.fill" />
        <NativeTabs.Trigger.Label>Files</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>
      <NativeTabs.Trigger
        listeners={{
          tabPress: (): void => {
            openAlternateIfRoot('changes')
          },
        }}
        name="(changes)"
      >
        <NativeTabs.Trigger.Icon sf="arrow.triangle.branch" />
        <NativeTabs.Trigger.Label>Changes</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>
      <NativeTabs.Trigger
        listeners={{
          tabPress: (): void => {
            openAlternateIfRoot('review')
          },
        }}
        name="(review)"
      >
        <NativeTabs.Trigger.Icon sf="checkmark.seal.fill" />
        <NativeTabs.Trigger.Label>Review</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="(terminal)">
        <NativeTabs.Trigger.Icon sf="terminal.fill" />
        <NativeTabs.Trigger.Label>Terminal</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>
    </NativeTabs>
  )
}

function openAlternateIfRoot(tab: TabWithAlternate): void {
  if (!useTabRootFocus.getState().roots[tab]) return
  router.push(TAB_ALTERNATES[tab].href)
}
