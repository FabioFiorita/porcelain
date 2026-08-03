import {
  Button,
  ContentUnavailableView,
  HStack,
  List,
  Picker,
  Section,
  Spacer,
  Text,
} from '@expo/ui/swift-ui'
import { listStyle, pickerStyle, tag } from '@expo/ui/swift-ui/modifiers'
import Constants from 'expo-constants'
import { router } from 'expo-router'

import { ListLinkRow } from '@/components/list-link-row'
import { ScreenHeader } from '@/components/screen-header'
import { ScreenHost } from '@/components/screen-host'
import type { Environment } from '@/lib/daemon/environment'
import {
  useActiveEnvironment,
  useConnectionState,
  useEnvironments,
} from '@/lib/daemon/environments-store'
import { type Preferences, setPreference, usePreferences } from '@/lib/preferences'
import { secondary } from '@/theme/modifiers'
import { environmentIconSymbol } from './environment-icon'
import { describeEnvironment } from './environment-status'

export function SettingsScreen(): React.JSX.Element {
  const environments = useEnvironments()
  const preferences = usePreferences()

  return (
    <>
      <ScreenHeader companion={null} showSettings={false} title="Settings" workspace={false} />
      <ScreenHost>
        <List modifiers={[listStyle('insetGrouped')]}>
          <Section title="Environments">
            {environments.length === 0 ? (
              <ContentUnavailableView
                description="Pair an environment group and the repos it exposes show up here."
                systemImage="point.3.connected.trianglepath.dotted"
                title="No environments"
              />
            ) : (
              environments.map((environment) => (
                <EnvironmentRow environment={environment} key={environment.id} />
              ))
            )}
            <Button
              label="Pair an environment group"
              onPress={(): void => router.push('/settings/pair')}
              systemImage="plus"
            />
          </Section>

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

          <Section title="Git">
            <Picker<Preferences['pullMode']>
              label="Pull behavior"
              modifiers={[pickerStyle('menu')]}
              onSelectionChange={(value: Preferences['pullMode']): void =>
                setPreference('pullMode', value)
              }
              selection={preferences.pullMode}
            >
              <Text modifiers={[tag('merge')]}>Merge</Text>
              <Text modifiers={[tag('rebase')]}>Rebase</Text>
            </Picker>
          </Section>

          <Section title="About">
            <ValueRow label="Version" value={Constants.expoConfig?.version ?? 'unknown'} />
          </Section>
        </List>
      </ScreenHost>
    </>
  )
}

function EnvironmentRow({ environment }: { environment: Environment }): React.JSX.Element {
  const active = useActiveEnvironment()
  const connection = useConnectionState()
  const status = describeEnvironment(environment, active, connection)
  const detail = `${environment.endpoints.length} ${environment.endpoints.length === 1 ? 'connection' : 'connections'} · ${status.label}`

  return (
    <ListLinkRow
      detail={detail}
      icon={environmentIconSymbol(environment.icon)}
      iconColor={status.color}
      label={environment.nickname}
      onPress={(): void => {
        router.push({
          params: { id: environment.id },
          pathname: '/settings/environment/[id]',
        })
      }}
    />
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
