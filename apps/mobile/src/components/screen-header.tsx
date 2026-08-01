import { Button, Host, HStack, Image, Text, VStack } from '@expo/ui/swift-ui'
import { buttonStyle, font, foregroundStyle } from '@expo/ui/swift-ui/modifiers'
import { type Href, router, Stack } from 'expo-router'

import { type ToolbarIconName, toolbarIcon } from '@/components/toolbar-icon'
import { useSelectedEnvironment } from '@/lib/environments'
import { useAccentColor } from '@/theme/colors'

/** A push this screen owns, sitting left of the two buttons every tab shares. */
export type ScreenAction = {
  href: Href
  icon: ToolbarIconName
  label: string
}

/**
 * The header every tab wears: title on the left, on the same row as the toolbar buttons.
 *
 * iOS pins the native header title to the centre — `headerTitleAlign` is documented as
 * having no effect there — so the title is a custom left header item and each stack layout
 * blanks the native one. The line beneath it is where the environment, project and worktree
 * pickers live: one home for "what am I looking at", instead of a picker per tab.
 */
export function ScreenHeader({
  action,
  title,
}: {
  action?: ScreenAction
  title: string
}): React.JSX.Element {
  const accentColor = useAccentColor()
  const selected = useSelectedEnvironment()
  const context = selected?.nickname ?? 'No environment'

  return (
    <>
      {/*
        `asChild` hands the whole left header slot to this element, and `matchContents`
        lets the SwiftUI stack size itself — a header item has no viewport to measure.
      */}
      <Stack.Toolbar asChild placement="left">
        <Host matchContents seedColor={accentColor}>
          <VStack alignment="leading" spacing={1}>
            <Text modifiers={[font({ size: 22, weight: 'bold' })]}>{title}</Text>
            <Button
              modifiers={[buttonStyle('plain')]}
              onPress={(): void => router.push('/workspace')}
            >
              <HStack spacing={3}>
                <Text
                  modifiers={[
                    font({ size: 12, weight: 'medium' }),
                    foregroundStyle({ style: 'secondary', type: 'hierarchical' }),
                  ]}
                >
                  {context}
                </Text>
                <Image
                  modifiers={[foregroundStyle({ style: 'secondary', type: 'hierarchical' })]}
                  size={8}
                  systemName="chevron.down"
                />
              </HStack>
            </Button>
          </VStack>
        </Host>
      </Stack.Toolbar>
      <Stack.Toolbar placement="right">
        {action === undefined ? null : (
          <Stack.Toolbar.Button
            accessibilityLabel={action.label}
            icon={toolbarIcon(action.icon)}
            onPress={(): void => router.push(action.href)}
          />
        )}
        {/*
          The renderer's companion panel is a second sidebar; a phone has room for one
          surface at a time, so here it is a sheet raised from the header instead.
        */}
        <Stack.Toolbar.Button
          accessibilityLabel="Companion"
          icon={toolbarIcon('companion')}
          onPress={(): void => router.push('/companion')}
        />
        <Stack.Toolbar.Button
          accessibilityLabel="Settings"
          icon={toolbarIcon('settings')}
          onPress={(): void => router.push('/settings')}
        />
      </Stack.Toolbar>
    </>
  )
}
