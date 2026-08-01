import {
  Button,
  ContentUnavailableView,
  Host,
  HStack,
  Image,
  List,
  Picker,
  Section,
  Spacer,
  SwipeActions,
  Text,
  VStack,
} from '@expo/ui/swift-ui'
import { font, foregroundStyle, listStyle, pickerStyle, tag } from '@expo/ui/swift-ui/modifiers'
import Constants from 'expo-constants'
import { router } from 'expo-router'
import * as Updates from 'expo-updates'

import { SheetCloseToolbar } from '@/components/sheet-close-toolbar'
import { type Environment, removeEnvironment, useEnvironments } from '@/lib/environments'
import { type Preferences, setPreference, usePreferences } from '@/lib/preferences'
import { useAccentColor } from '@/theme/colors'

/** iOS systemGray — a paired-but-idle daemon, the only status this build can honestly show. */
const IDLE_STATUS_COLOR = '#8E8E93'

const secondary = foregroundStyle({ style: 'secondary', type: 'hierarchical' })

export function SettingsScreen(): React.JSX.Element {
  const accentColor = useAccentColor()
  const environments = useEnvironments()
  const preferences = usePreferences()

  return (
    <>
      <Host seedColor={accentColor} style={{ flex: 1 }} useViewportSizeMeasurement>
        <List modifiers={[listStyle('insetGrouped')]}>
          {/*
            Environments and About are sections, not rows that push a screen: Settings holds
            three things, and pushing to reach any of them costs a tap and shows less. There
            is no Appearance entry at all — the app follows the phone.
          */}
          <Section title="Environments">
            {environments.length === 0 ? (
              <ContentUnavailableView
                description="Pair a daemon and the repos it exposes show up here. Until then there is nothing to review."
                systemImage="point.3.connected.trianglepath.dotted"
                title="No environments"
              />
            ) : (
              environments.map((environment) => (
                <EnvironmentRow environment={environment} key={environment.id} />
              ))
            )}
            <Button
              label="Pair an environment"
              onPress={(): void => router.push('/settings/pair')}
              systemImage="plus"
            />
          </Section>

          {/* Mirrors the renderer's General settings so a file reads the same on both clients. */}
          <Section title="Reading">
            <Picker<Preferences['markdown']>
              label="Markdown"
              modifiers={[pickerStyle('menu')]}
              onSelectionChange={(value: Preferences['markdown']): void =>
                setPreference('markdown', value)
              }
              selection={preferences.markdown}
            >
              <Text modifiers={[tag('reader')]}>Reader</Text>
              <Text modifiers={[tag('source')]}>Source</Text>
            </Picker>
            <Picker<Preferences['html']>
              label="HTML"
              modifiers={[pickerStyle('menu')]}
              onSelectionChange={(value: Preferences['html']): void => setPreference('html', value)}
              selection={preferences.html}
            >
              <Text modifiers={[tag('preview')]}>Preview</Text>
              <Text modifiers={[tag('source')]}>Source</Text>
            </Picker>
            <Picker<Preferences['diffLayout']>
              label="Diff layout"
              modifiers={[pickerStyle('menu')]}
              onSelectionChange={(value: Preferences['diffLayout']): void =>
                setPreference('diffLayout', value)
              }
              selection={preferences.diffLayout}
            >
              <Text modifiers={[tag('unified')]}>Unified</Text>
              <Text modifiers={[tag('split')]}>Split</Text>
            </Picker>
          </Section>

          <Section title="About">
            <ValueRow label="Version" value={Constants.expoConfig?.version ?? 'unknown'} />
            {Updates.updateId === null ? null : (
              <ValueRow label="Update" value={Updates.updateId.slice(0, 7)} />
            )}
          </Section>
        </List>
      </Host>
      <SheetCloseToolbar />
    </>
  )
}

function EnvironmentRow({ environment }: { environment: Environment }): React.JSX.Element {
  return (
    <SwipeActions>
      <HStack spacing={10}>
        <Image color={IDLE_STATUS_COLOR} size={10} systemName="circle.fill" />
        <VStack alignment="leading" spacing={2}>
          <Text>{environment.nickname}</Text>
          <Text modifiers={[font({ textStyle: 'footnote' }), secondary]}>
            {environment.baseUrl}
          </Text>
        </VStack>
        <Spacer />
        {/*
          A status, not a switch: connecting is the daemon's business, and a toggle that
          cannot actually disconnect anything is a control that lies.
        */}
        <Text modifiers={[font({ textStyle: 'footnote' }), secondary]}>Not connected</Text>
      </HStack>
      <SwipeActions.Actions>
        <Button
          label="Remove"
          onPress={(): void => removeEnvironment(environment.id)}
          role="destructive"
          systemImage="trash"
        />
      </SwipeActions.Actions>
    </SwipeActions>
  )
}

function ValueRow({ label, value }: { label: string; value: string }): React.JSX.Element {
  return (
    <HStack>
      <Text>{label}</Text>
      <Spacer />
      <Text modifiers={[secondary]}>{value}</Text>
    </HStack>
  )
}
