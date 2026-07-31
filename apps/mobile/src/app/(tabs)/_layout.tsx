import { NativeTabs } from 'expo-router/unstable-native-tabs'

import { colors } from '@/theme/colors'

export default function TabsLayout() {
  return (
    <NativeTabs minimizeBehavior="onScrollDown" tintColor={colors.tint}>
      <NativeTabs.Trigger name="(files)">
        <NativeTabs.Trigger.Icon sf="folder.fill" md="folder" />
        <NativeTabs.Trigger.Label>Files</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="(changes)">
        <NativeTabs.Trigger.Icon sf="arrow.triangle.branch" md="difference" />
        <NativeTabs.Trigger.Label>Changes</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="(review)">
        <NativeTabs.Trigger.Icon sf="checkmark.seal.fill" md="fact_check" />
        <NativeTabs.Trigger.Label>Review</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="(terminal)">
        <NativeTabs.Trigger.Icon sf="terminal.fill" md="terminal" />
        <NativeTabs.Trigger.Label>Terminal</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>
    </NativeTabs>
  )
}
