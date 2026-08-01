import { Button, Host, HStack, Image, Menu, Picker, Text, VStack } from '@expo/ui/swift-ui'
import { disabled, font, foregroundStyle, pickerStyle, tag } from '@expo/ui/swift-ui/modifiers'
import { type Href, router, Stack } from 'expo-router'

import { type ToolbarIconName, toolbarIcon } from '@/components/toolbar-icon'
import { selectEnvironment, useEnvironments, useSelectedEnvironment } from '@/lib/environments'
import { useAccentColor } from '@/theme/colors'

/** A push this screen owns, sitting left of the two buttons every tab shares. */
export type ScreenAction = {
  href: Href
  icon: ToolbarIconName
  label: string
}

const secondary = foregroundStyle({ style: 'secondary', type: 'hierarchical' })

/**
 * The header every tab wears: title left, on the same row as the toolbar buttons.
 *
 * iOS pins the native title to the centre (`headerTitleAlign` is a no-op there), so this is a
 * custom left item and each stack blanks the native one. `hidesSharedBackground` drops the
 * glass capsule iOS 26 wraps a custom bar item in — inside it the title sits flush against
 * the capsule rather than at the header's own inset.
 */
export function ScreenHeader({
  action,
  title,
}: {
  action?: ScreenAction
  title: string
}): React.JSX.Element {
  const accentColor = useAccentColor()
  const environments = useEnvironments()
  const selected = useSelectedEnvironment()

  // The line names the repo you are reading, which is what a project picker selects. Until a
  // daemon can list one it falls back to the environment, then to the action that gets you one.
  const context = selected?.nickname ?? 'Pair an environment'

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
                  <Button label="Needs an environment" modifiers={[disabled(true)]} />
                </Menu>
                <Menu label="Environment" systemImage="desktopcomputer">
                  {environments.length === 0 ? (
                    <Button
                      label="Pair an environment"
                      onPress={(): void => router.push('/settings/pair')}
                      systemImage="plus"
                    />
                  ) : (
                    // An inline Picker is what puts the checkmark beside the current row.
                    <Picker<string>
                      label="Environment"
                      modifiers={[pickerStyle('inline')]}
                      onSelectionChange={(id: string): void => selectEnvironment(id)}
                      selection={selected?.id ?? ''}
                    >
                      {environments.map((environment) => (
                        <Text key={environment.id} modifiers={[tag(environment.id)]}>
                          {environment.nickname}
                        </Text>
                      ))}
                    </Picker>
                  )}
                </Menu>
              </Menu>
            </VStack>
          </Host>
        </Stack.Toolbar.View>
      </Stack.Toolbar>
      {/*
        Two buttons, never more. The companion keeps its own because it is a view toggle
        used constantly while reading; everything that navigates away goes in the menu.
      */}
      <Stack.Toolbar placement="right">
        <Stack.Toolbar.Button
          accessibilityLabel="Companion"
          icon={toolbarIcon('companion')}
          onPress={(): void => router.push('/companion')}
        />
        <Stack.Toolbar.Menu accessibilityLabel="More" icon={toolbarIcon('overflow')}>
          {action === undefined ? null : (
            <Stack.Toolbar.MenuAction
              icon={toolbarIcon(action.icon)}
              onPress={(): void => router.push(action.href)}
            >
              {action.label}
            </Stack.Toolbar.MenuAction>
          )}
          <Stack.Toolbar.MenuAction
            icon={toolbarIcon('settings')}
            onPress={(): void => router.push('/settings')}
          >
            Settings
          </Stack.Toolbar.MenuAction>
        </Stack.Toolbar.Menu>
      </Stack.Toolbar>
    </>
  )
}
