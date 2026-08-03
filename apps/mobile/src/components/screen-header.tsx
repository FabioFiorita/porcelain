import { Host, Text, VStack } from '@expo/ui/swift-ui'
import { font } from '@expo/ui/swift-ui/modifiers'
import { Stack } from 'expo-router'

import { HeaderToolbar, type ScreenAction } from '@/components/header-toolbar'
import { WorkspaceContext } from '@/components/workspace-context'
import { useAccentColor } from '@/theme/colors'

/**
 * Phone root chrome: large title on the left, workspace (project · branch · worktree) on the
 * line under it, trailing actions + companion + settings on the right.
 *
 * iOS centres the native title slot, so we blank it and draw this custom left item instead.
 * `hidesSharedBackground` drops the iOS 26 glass capsule so the title sits at the header inset.
 */
export function ScreenHeader({
  actions,
  companion,
  showSettings = true,
  title,
  workspace = true,
}: {
  actions?: readonly ScreenAction[]
  companion?: ScreenAction | null
  showSettings?: boolean
  title: string
  workspace?: boolean
}): React.JSX.Element {
  const accentColor = useAccentColor()

  return (
    <>
      <Stack.Toolbar placement="left">
        <Stack.Toolbar.View hidesSharedBackground>
          <Host matchContents seedColor={accentColor}>
            <VStack alignment="leading" spacing={2}>
              <Text modifiers={[font({ size: 22, weight: 'bold' })]}>{title}</Text>
              {workspace ? <WorkspaceContext /> : null}
            </VStack>
          </Host>
        </Stack.Toolbar.View>
      </Stack.Toolbar>
      <HeaderToolbar actions={actions} companion={companion} showSettings={showSettings} />
    </>
  )
}
