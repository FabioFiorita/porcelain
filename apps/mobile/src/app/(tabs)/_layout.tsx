import { NativeTabs } from 'expo-router/unstable-native-tabs'

import { useAccentColor } from '@/theme/colors'

export default function TabsLayout(): React.JSX.Element {
  const accentColor = useAccentColor()

  return (
    // `sidebarAdaptable` is iPad/macOS-only (iOS 18+, no effect on iPhone): it lets the system
    // promote the tab bar to the side tab bar / sidebar instead of pinning a phone-sized bottom
    // bar to a 13" screen. Every trigger below feeds both presentations, so there is one tab list.
    <NativeTabs minimizeBehavior="onScrollDown" sidebarAdaptable tintColor={accentColor}>
      <NativeTabs.Trigger name="(files)">
        <NativeTabs.Trigger.Icon sf="folder.fill" />
        <NativeTabs.Trigger.Label>Files</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="(changes)">
        <NativeTabs.Trigger.Icon sf="arrow.triangle.branch" />
        <NativeTabs.Trigger.Label>Changes</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="(review)">
        {/*
          Reading a change closely, not stamping it: Review is the work read as a story, so
          the glyph is a magnifier over text rather than the seal it used to be — that one
          read as an approve button, which is not what the tab does.
        */}
        <NativeTabs.Trigger.Icon sf="text.magnifyingglass" />
        <NativeTabs.Trigger.Label>Review</NativeTabs.Trigger.Label>
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
    </NativeTabs>
  )
}
