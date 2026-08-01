import {
  Button,
  ContentUnavailableView,
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
import { disabled, font, listStyle, pickerStyle, tag } from '@expo/ui/swift-ui/modifiers'
import { endpointKind } from '@porcelain/contracts'
import Constants from 'expo-constants'
import { router } from 'expo-router'
import * as Updates from 'expo-updates'

import { ScreenHost } from '@/components/screen-host'
import { SheetCloseToolbar } from '@/components/sheet-close-toolbar'
import { getDaemonClient } from '@/lib/daemon/client'
import { type Environment, isPaired } from '@/lib/daemon/environment'
import {
  type ConnectionState,
  environmentActions,
  useActiveEnvironment,
  useConnectionState,
  useEnvironments,
} from '@/lib/daemon/environments-store'
import { callDaemon } from '@/lib/daemon/procedure'
import { revokeCurrentClientMutation } from '@/lib/daemon/procedures/connection'
import { type Preferences, setPreference, usePreferences } from '@/lib/preferences'
import { secondary } from '@/theme/modifiers'

/** iOS system colours: gray idle, green connected, orange unreachable, red revoked. */
const STATUS_COLORS = {
  idle: '#8E8E93',
  ready: '#34C759',
  unreachable: '#FF9500',
  unauthorized: '#FF3B30',
} as const

function describeConnection(connection: ConnectionState): {
  color: string
  label: string
} {
  switch (connection.kind) {
    case 'ready':
      return { color: STATUS_COLORS.ready, label: connection.daemonVersion ?? 'Connected' }
    case 'unreachable':
      return { color: STATUS_COLORS.unreachable, label: 'Unreachable' }
    case 'unauthorized':
      return { color: STATUS_COLORS.unauthorized, label: 'Token revoked' }
    case 'connecting':
    case 'loading':
      return { color: STATUS_COLORS.idle, label: 'Connecting…' }
    case 'no-environment':
      return { color: STATUS_COLORS.idle, label: 'Not connected' }
  }
}

export function SettingsScreen(): React.JSX.Element {
  const environments = useEnvironments()
  const preferences = usePreferences()

  return (
    <>
      <ScreenHost>
        <List modifiers={[listStyle('insetGrouped')]}>
          {/*
            Environments and About are sections, not rows that push a screen: Settings holds
            three things, and pushing to reach any of them costs a tap and shows less. There
            is no Appearance entry at all — the app follows the phone.
          */}
          <Section title="Environments">
            {environments.length === 0 ? (
              <ContentUnavailableView
                description="Pair an environment group and the repos it exposes show up here. Until then there is nothing to review."
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
      </ScreenHost>
      <SheetCloseToolbar />
    </>
  )
}

function EnvironmentRow({ environment }: { environment: Environment }): React.JSX.Element {
  const active = useActiveEnvironment()
  const connection = useConnectionState()
  const isActive = active?.id === environment.id
  const status = isActive
    ? describeConnection(connection)
    : {
        color: environment.token === null ? STATUS_COLORS.unauthorized : STATUS_COLORS.idle,
        label: environment.token === null ? 'Token revoked' : 'Paired',
      }

  /**
   * Revoke host-side first, then forget locally either way: an unreachable daemon cannot be
   * told, and a local delete that pretends the credential is dead is the failure to avoid.
   */
  async function unpair(): Promise<void> {
    // Revoked with this row's OWN credential — the react-query hooks only ever speak to the
    // active environment, which would leave a background daemon's token alive on the host.
    if (isPaired(environment)) {
      try {
        await callDaemon(getDaemonClient(environment), revokeCurrentClientMutation, undefined)
      } catch {
        // An unreachable host keeps the credential until someone revokes it there.
      }
    }
    await environmentActions.remove(environment.id)
  }

  return (
    <SwipeActions>
      <HStack spacing={10}>
        <Image color={status.color} size={10} systemName="circle.fill" />
        <VStack alignment="leading" spacing={6}>
          <Text>{environment.nickname}</Text>
          <Text modifiers={[font({ textStyle: 'footnote' }), secondary]}>
            {environment.endpoints.length === 1
              ? '1 connection'
              : `${environment.endpoints.length} connections`}
          </Text>
          <VStack alignment="leading" spacing={3}>
            {environment.endpoints.map((endpoint) => {
              const preferred =
                environment.preferredKind !== undefined &&
                endpointKind(endpoint) === environment.preferredKind
              return (
                <HStack key={endpoint} spacing={6}>
                  <Image size={8} systemName={preferred ? 'checkmark.circle.fill' : 'circle'} />
                  <VStack alignment="leading" spacing={0}>
                    <Text modifiers={[font({ textStyle: 'caption' })]}>
                      {endpointLabel(endpoint)}
                    </Text>
                    <Text modifiers={[font({ textStyle: 'caption2' }), secondary]}>{endpoint}</Text>
                  </VStack>
                  <Spacer />
                  {preferred ? (
                    <Text modifiers={[font({ textStyle: 'caption2' }), secondary]}>Primary</Text>
                  ) : (
                    <Button
                      label="Make primary"
                      onPress={(): void => {
                        environmentActions.preferEndpoint(environment.id, endpoint)
                      }}
                    />
                  )}
                  <Button
                    label="Remove connection"
                    onPress={(): void => {
                      environmentActions.removeEndpoint(environment.id, endpoint)
                    }}
                    role="destructive"
                    systemImage="trash"
                    modifiers={[disabled(environment.endpoints.length === 1)]}
                  />
                </HStack>
              )
            })}
          </VStack>
          <Button
            label="Add connection"
            onPress={(): void => {
              router.push({
                pathname: '/settings/pair',
                params: { environmentId: environment.id },
              })
            }}
            systemImage="plus"
          />
        </VStack>
        <Spacer />
        <Text modifiers={[font({ textStyle: 'footnote' }), secondary]}>{status.label}</Text>
      </HStack>
      <SwipeActions.Actions>
        <Button
          label="Unpair"
          onPress={(): void => {
            unpair()
          }}
          role="destructive"
          systemImage="trash"
        />
      </SwipeActions.Actions>
    </SwipeActions>
  )
}

function endpointLabel(endpoint: string): string {
  switch (endpointKind(endpoint)) {
    case 'lan':
      return 'LAN'
    case 'tailnet':
      return 'Tailscale'
    case 'other':
      return 'Funnel / Internet'
  }
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
