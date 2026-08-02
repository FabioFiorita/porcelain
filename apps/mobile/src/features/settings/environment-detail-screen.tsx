import {
  Button,
  ConfirmationDialog,
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
import {
  disabled,
  font,
  foregroundStyle,
  listStyle,
  pickerStyle,
  tag,
} from '@expo/ui/swift-ui/modifiers'
import { router, useLocalSearchParams } from 'expo-router'
import { useState } from 'react'

import { ScreenHost } from '@/components/screen-host'
import { getDaemonClient } from '@/lib/daemon/client'
import { type EnvironmentIcon, isPaired } from '@/lib/daemon/environment'
import {
  environmentActions,
  useActiveEnvironment,
  useConnectionState,
  useEnvironments,
} from '@/lib/daemon/environments-store'
import { callDaemon } from '@/lib/daemon/procedure'
import { revokeCurrentClientMutation } from '@/lib/daemon/procedures/connection'
import { secondary } from '@/theme/modifiers'
import { ENVIRONMENT_ICON_OPTIONS, environmentIconSymbol } from './environment-icon'
import { describeEnvironment } from './environment-status'

export function EnvironmentDetailScreen(): React.JSX.Element {
  const { id } = useLocalSearchParams<{ id?: string }>()
  const environments = useEnvironments()
  const active = useActiveEnvironment()
  const connection = useConnectionState()
  const environment = environments.find((candidate) => candidate.id === id) ?? null
  const [unpairPresented, setUnpairPresented] = useState(false)
  const [operationError, setOperationError] = useState<string | null>(null)

  if (environment === null) {
    return (
      <ScreenHost>
        <ContentUnavailableView
          description="This environment group is no longer stored on this device."
          systemImage="questionmark.circle"
          title="Environment unavailable"
        />
      </ScreenHost>
    )
  }

  const target = environment
  const status = describeEnvironment(target, active, connection)

  async function unpair(): Promise<void> {
    setUnpairPresented(false)
    setOperationError(null)
    try {
      if (isPaired(target)) {
        try {
          await callDaemon(getDaemonClient(target), revokeCurrentClientMutation, undefined)
        } catch {
          // An unreachable host keeps its credential until it can be revoked there.
        }
      }
      await environmentActions.remove(target.id)
      router.back()
    } catch (cause) {
      setOperationError(
        cause instanceof Error ? cause.message : 'The environment could not be removed.',
      )
    }
  }

  async function selectEnvironment(): Promise<void> {
    if (active?.id === target.id) return
    setOperationError(null)
    try {
      await environmentActions.setActive(target.id)
    } catch (cause) {
      setOperationError(
        cause instanceof Error ? cause.message : 'The environment could not be selected.',
      )
    }
  }

  function selectIcon(icon: EnvironmentIcon): void {
    setOperationError(null)
    environmentActions.setIcon(target.id, icon).catch((cause: unknown) => {
      setOperationError(
        cause instanceof Error ? cause.message : 'The environment icon could not be saved.',
      )
    })
  }

  function removeConnection(endpoint: string): void {
    setOperationError(null)
    environmentActions.removeEndpoint(target.id, endpoint).catch((cause: unknown) => {
      setOperationError(
        cause instanceof Error ? cause.message : 'The connection could not be removed.',
      )
    })
  }

  return (
    <ScreenHost>
      <List modifiers={[listStyle('insetGrouped')]}>
        <Section title="Status">
          <HStack spacing={10}>
            <Image
              color={status.color}
              size={22}
              systemName={environmentIconSymbol(environment.icon)}
            />
            <VStack alignment="leading" spacing={3}>
              <Text modifiers={[font({ textStyle: 'headline' })]}>{environment.nickname}</Text>
              <Text modifiers={[secondary]}>{status.label}</Text>
            </VStack>
            <Spacer />
            <Text modifiers={[secondary]}>
              {`${environment.endpoints.length} ${environment.endpoints.length === 1 ? 'connection' : 'connections'}`}
            </Text>
          </HStack>
          <Button
            label={active?.id === target.id ? 'Active environment' : 'Use this environment'}
            modifiers={[disabled(active?.id === target.id)]}
            onPress={(): void => {
              selectEnvironment()
            }}
            systemImage="checkmark.circle"
          />
          <Picker<EnvironmentIcon>
            label="Icon"
            modifiers={[pickerStyle('menu')]}
            onSelectionChange={selectIcon}
            selection={environment.icon}
          >
            {ENVIRONMENT_ICON_OPTIONS.map((option) => (
              <Text key={option.id} modifiers={[tag(option.id)]}>
                {option.label}
              </Text>
            ))}
          </Picker>
        </Section>

        <Section title="Connections">
          {environment.endpoints.map((endpoint) => {
            const preferred = environment.preferredEndpoint === endpoint
            const content = (
              <VStack alignment="leading" key={endpoint} spacing={5}>
                <HStack spacing={8}>
                  <VStack alignment="leading" spacing={2}>
                    <Text>{endpoint}</Text>
                    <Text modifiers={[font({ textStyle: 'footnote' }), secondary]}>
                      {preferred ? 'Primary connection' : 'Available connection'}
                    </Text>
                  </VStack>
                  <Spacer />
                  {preferred ? null : (
                    <Button
                      label="Make primary"
                      onPress={(): void => {
                        environmentActions.preferEndpoint(environment.id, endpoint)
                      }}
                    />
                  )}
                </HStack>
              </VStack>
            )
            if (environment.endpoints.length === 1) {
              return content
            }
            return (
              <SwipeActions key={endpoint}>
                {content}
                <SwipeActions.Actions allowsFullSwipe={false} edge="trailing">
                  <Button
                    label="Remove"
                    onPress={(): void => {
                      removeConnection(endpoint)
                    }}
                    role="destructive"
                    systemImage="trash"
                  />
                </SwipeActions.Actions>
              </SwipeActions>
            )
          })}
          <Button
            label="Add connection"
            onPress={(): void => {
              router.push({
                params: { environmentId: environment.id },
                pathname: '/settings/pair',
              })
            }}
            systemImage="plus"
          />
        </Section>

        <Section title="Danger zone">
          <Button
            label="Unpair environment group"
            modifiers={[foregroundStyle({ color: '#FF3B30', type: 'color' })]}
            onPress={(): void => setUnpairPresented(true)}
            role="destructive"
            systemImage="trash"
          />
          {operationError === null ? null : <Text modifiers={[secondary]}>{operationError}</Text>}
        </Section>
      </List>
      <ConfirmationDialog
        isPresented={unpairPresented}
        onIsPresentedChange={setUnpairPresented}
        title={`Unpair ${environment.nickname}?`}
      >
        <ConfirmationDialog.Message>
          <Text>This removes the group and its saved credentials from this device.</Text>
        </ConfirmationDialog.Message>
        <ConfirmationDialog.Actions>
          <Button
            label="Unpair"
            onPress={(): void => {
              unpair()
            }}
            role="destructive"
          />
          <Button label="Cancel" onPress={(): void => setUnpairPresented(false)} role="cancel" />
        </ConfirmationDialog.Actions>
      </ConfirmationDialog>
    </ScreenHost>
  )
}
