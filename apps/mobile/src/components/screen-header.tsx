import { Host, Text, VStack } from '@expo/ui/swift-ui'
import { font } from '@expo/ui/swift-ui/modifiers'
import { Stack } from 'expo-router'
import { Platform } from 'react-native'

import { HeaderToolbar, type ScreenAction } from '@/components/header-toolbar'
import { WorkspaceContext } from '@/components/workspace-context'
import { useAccentColor } from '@/theme/colors'

function isIPad(): boolean {
  return 'isPad' in Platform && Platform.isPad
}

/**
 * Phone root chrome: large title on the left, workspace (project · branch · worktree) on the
 * line under it, trailing actions + companion + settings on the right.
 *
 * iOS centres the native title slot, so we blank it and draw this custom left item instead.
 * `hidesSharedBackground` drops the iOS 26 glass capsule so the title sits at the header inset.
 *
 * On iPad the companion is the SplitView inspector — do not push the `/companion` sheet.
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
  // iPad: inspector is the companion. Only honour an explicit override; default is no sheet.
  const companionAction = companion !== undefined ? companion : isIPad() ? null : undefined

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
      <HeaderToolbar actions={actions} companion={companionAction} showSettings={showSettings} />
    </>
  )
}
