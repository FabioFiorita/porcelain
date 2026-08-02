import { NativeTabs } from 'expo-router/unstable-native-tabs'

import { useAccentColor } from '@/theme/colors'

export default function TabsLayout(): React.JSX.Element {
  const accentColor = useAccentColor()

  return (
    <NativeTabs minimizeBehavior="onScrollDown" tintColor={accentColor}>
      <NativeTabs.Trigger name="(files)">
        <NativeTabs.Trigger.Icon sf="folder.fill" />
        <NativeTabs.Trigger.Label>Files</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="(changes)">
        <NativeTabs.Trigger.Icon sf="arrow.triangle.branch" />
        <NativeTabs.Trigger.Label>Changes</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>
      {/*
        The plan is a peer of the work, not a child of the Review that reports it — the
        renderer has carried Board as its own sidebar tab all along.
      */}
      <NativeTabs.Trigger name="(board)">
        <NativeTabs.Trigger.Icon sf="rectangle.3.group.fill" />
        <NativeTabs.Trigger.Label>Board</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="(terminal)">
        <NativeTabs.Trigger.Icon sf="terminal.fill" />
        <NativeTabs.Trigger.Label>Terminal</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="settings">
        <NativeTabs.Trigger.Icon sf="gearshape.fill" />
        <NativeTabs.Trigger.Label>Settings</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>
    </NativeTabs>
  )
}
