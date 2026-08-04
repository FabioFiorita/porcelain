import { NativeTabs } from 'expo-router/unstable-native-tabs'

/**
 * Phone entry only. Tablet chrome lives in `features/shell/tablet-shell`.
 * History / Search / Board are not phone tab roots yet (re-tap / push later).
 */
export function PocIPhoneEntryPoint(): React.JSX.Element {
  return (
    <NativeTabs disableTransparentOnScrollEdge minimizeBehavior="onScrollDown" tintColor="#0A84FF">
      <NativeTabs.Trigger name="index">
        <NativeTabs.Trigger.Icon sf="folder.fill" md="folder" />
        <NativeTabs.Trigger.Label>Files</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="changes">
        <NativeTabs.Trigger.Icon sf="arrow.triangle.branch" md="account_tree" />
        <NativeTabs.Trigger.Label>Changes</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Badge>3</NativeTabs.Trigger.Badge>
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="review">
        <NativeTabs.Trigger.Icon sf="checkmark.bubble.fill" md="rate_review" />
        <NativeTabs.Trigger.Label>Review</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="terminal">
        <NativeTabs.Trigger.Icon sf="terminal.fill" md="terminal" />
        <NativeTabs.Trigger.Label>Terminal</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>
    </NativeTabs>
  )
}
