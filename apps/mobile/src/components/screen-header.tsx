import { Host, Text, VStack } from '@expo/ui/swift-ui'
import { font } from '@expo/ui/swift-ui/modifiers'
import { Stack } from 'expo-router'

import { HeaderToolbar, type ScreenAction } from '@/components/header-toolbar'
import { WorkspaceContext } from '@/components/workspace-context'
import { useAccentColor } from '@/theme/colors'

/**
 * The header every tab wears: title left, on the same row as the toolbar buttons.
 *
 * iOS pins the native title to the centre (`headerTitleAlign` is a no-op there), so this is a
 * custom left item and each stack blanks the native one. `hidesSharedBackground` drops the
 * glass capsule iOS 26 wraps a custom bar item in — inside it the title sits flush against
 * the capsule rather than at the header's own inset.
 */
export function ScreenHeader({
  actions,
  companion,
  title,
}: {
  actions?: readonly ScreenAction[]
  companion?: ScreenAction | null
  title: string
}): React.JSX.Element {
  const accentColor = useAccentColor()

  return (
    <>
      <Stack.Toolbar placement="left">
        <Stack.Toolbar.View hidesSharedBackground>
          <Host matchContents seedColor={accentColor}>
            <VStack alignment="leading" spacing={0}>
              <Text modifiers={[font({ size: 22, weight: 'bold' })]}>{title}</Text>
            </VStack>
          </Host>
        </Stack.Toolbar.View>
      </Stack.Toolbar>
      <HeaderToolbar actions={actions} companion={companion} workspace={<WorkspaceContext />} />
    </>
  )
}
