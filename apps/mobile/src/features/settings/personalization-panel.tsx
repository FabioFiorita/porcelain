import { EmptyNote } from '@/components/panel-chrome'

/**
 * Settings › Personalization — the copyable story-order instruction. Pins and hides are manual
 * file-tree gestures and are not part of this surface. Mobile has no instruction UI yet.
 */
export function PersonalizationSettings(): React.JSX.Element {
  return (
    <EmptyNote
      body="Pins and hides stay manual in the file tree. The copyable story-order instruction is available in the desktop client; mobile does not show it yet."
      testID="porcelain-settings-personalization-empty"
      title="Story instruction not on mobile yet"
    />
  )
}
