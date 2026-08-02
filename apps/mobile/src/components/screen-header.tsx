import { Button, Host, HStack, Image, Menu, Text, VStack } from '@expo/ui/swift-ui'
import { font } from '@expo/ui/swift-ui/modifiers'
import { router, Stack } from 'expo-router'

import { HeaderToolbar, type ScreenAction } from '@/components/header-toolbar'
import { useActiveRepo } from '@/lib/daemon/repo'
import { useAccentColor } from '@/theme/colors'
import { secondary } from '@/theme/modifiers'

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
  const repo = useActiveRepo()

  // The line names the repo you are reading, which is what a project picker selects. Environment
  // routing stays in Settings; putting its selector here made the toolbar change meaning on every
  // screen and made a four-button header out of a contextual control.
  const context = repo?.name ?? 'Choose project'

  return (
    <>
      <Stack.Toolbar placement="left">
        <Stack.Toolbar.View hidesSharedBackground>
          <Host matchContents seedColor={accentColor}>
            <VStack alignment="leading" spacing={0}>
              <Text modifiers={[font({ size: 22, weight: 'bold' })]}>{title}</Text>
              <Menu
                label={
                  <HStack spacing={3}>
                    <Text modifiers={[font({ size: 12, weight: 'medium' }), secondary]}>
                      {context}
                    </Text>
                    <Image modifiers={[secondary]} size={8} systemName="chevron.down" />
                  </HStack>
                }
              >
                <Menu label="Project" systemImage="folder">
                  <Button label="Choose repo…" onPress={(): void => router.push('/repo')} />
                </Menu>
              </Menu>
            </VStack>
          </Host>
        </Stack.Toolbar.View>
      </Stack.Toolbar>
      <HeaderToolbar actions={actions} companion={companion} />
    </>
  )
}
