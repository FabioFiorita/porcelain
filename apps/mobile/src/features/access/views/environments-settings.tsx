import { Fragment, useState } from 'react';
import { BottomSheet } from '@expo/ui';
import { Stack } from 'expo-router';
import { ScrollView } from 'react-native';
import { Box } from '../../../components/ui/box';
import { Button } from '../../../components/ui/button';
import { Card } from '../../../components/ui/card';
import { ErrorState } from '../../../components/ui/error-state';
import { Loading } from '../../../components/ui/loading';
import { Separator } from '../../../components/ui/separator';
import { Text } from '../../../components/ui/text';
import { headerIcon } from '../../../shared/icons/header-icon';
import { useReadEnvironments } from '../commands/pairing';
import {
  useEnvironments,
  useEnvironmentStorageStatus,
  useMissingCredentials,
} from '../store';
import { ComputerUpdatesSummary } from './computer-updates-summary';
import { MissingCredentialRow } from './missing-credential-row';
import { EnvironmentRow } from './environment-row';
import { PairEnvironment } from './pair-environment';
import { PairEnvironmentForm } from './pair-environment-form';
import { ThisComputer } from './this-computer';

function EnvironmentSettingsSection({
  presentation = 'overview',
  showHeading = true,
  inlinePairing = false,
}: {
  inlinePairing?: boolean;
  presentation?: 'overview' | 'destination';
  showHeading?: boolean;
}) {
  const [pairing, setPairing] = useState(false);
  const [computerId, setComputerId] = useState<string | null>(null);
  const remotes = useEnvironments();
  const computer = remotes.find(
    (remote) => remote.environmentId === computerId,
  );
  const missing = useMissingCredentials();
  const storage = useEnvironmentStorageStatus();
  const read = useReadEnvironments();
  const nativeAdd = presentation === 'destination' && !showHeading;
  return (
    <>
      {nativeAdd ? (
        <Stack.Toolbar placement="right">
          <Stack.Toolbar.Button
            icon={headerIcon('add')}
            accessibilityLabel="Add computer"
            disabled={storage.status !== 'ready'}
            onPress={() => setPairing(true)}
          />
        </Stack.Toolbar>
      ) : null}
      <Box gap={3}>
        <ComputerUpdatesSummary />
        {!nativeAdd ? (
          <Box
            className="flex-row flex-wrap items-center justify-between"
            gap={3}
          >
            <Text
              variant={
                presentation === 'destination' ? 'heading' : 'subheading'
              }
              tone={presentation === 'destination' ? 'default' : 'muted'}
            >
              Computers
            </Text>
            <Button
              testID="add-environment"
              className="max-w-full"
              variant="outline"
              label="Add computer"
              disabled={storage.status !== 'ready'}
              onPress={() => setPairing(true)}
            />
          </Box>
        ) : null}
        {presentation === 'destination' ? (
          <Text variant="caption" tone="muted">
            Manage the computers connected to Porcelain.
          </Text>
        ) : null}
        {inlinePairing && pairing ? (
          <Card padding={4}>
            <PairEnvironmentForm onClose={() => setPairing(false)} />
          </Card>
        ) : null}
        {storage.status === 'loading' ? (
          <Loading label="Reading saved computers…" />
        ) : null}
        {storage.error ? (
          <ErrorState
            message={storage.error}
            retry={{ label: 'Try again', onPress: () => read(undefined) }}
          />
        ) : null}
        {storage.status === 'ready' &&
        remotes.length === 0 &&
        missing.length === 0 ? (
          <Card gap={2} padding={4}>
            <Text variant="ui" weight="medium">
              No computers paired.
            </Text>
            <Text variant="caption" tone="muted">
              Select Add computer to connect to a computer running Porcelain
              with its pairing link.
            </Text>
          </Card>
        ) : null}
        {missing
          .filter(
            (entry) =>
              !remotes.some(
                (remote) => remote.environmentId === entry.environmentId,
              ),
          )
          .map((remote) => (
            <Card key={remote.environmentId}>
              <MissingCredentialRow
                remote={remote}
                disabled={storage.status !== 'ready'}
              />
            </Card>
          ))}
        {remotes.length > 0 ? (
          <Card className="overflow-hidden">
            {remotes.map((remote, index) => (
              <Fragment key={remote.environmentId}>
                {index > 0 ? <Separator /> : null}
                <EnvironmentRow
                  remote={remote}
                  missing={missing.find(
                    (entry) => entry.environmentId === remote.environmentId,
                  )}
                  disabled={storage.status !== 'ready'}
                  onOpenComputer={() => setComputerId(remote.environmentId)}
                />
              </Fragment>
            ))}
          </Card>
        ) : null}
      </Box>
      {!inlinePairing ? (
        <BottomSheet
          isPresented={pairing}
          onDismiss={() => setPairing(false)}
          contentPadding={0}
          snapPoints={['half', 'full']}
        >
          {pairing ? (
            <PairEnvironment onClose={() => setPairing(false)} />
          ) : null}
        </BottomSheet>
      ) : null}
      <BottomSheet
        isPresented={computer !== undefined}
        onDismiss={() => setComputerId(null)}
        contentPadding={0}
        snapPoints={['half', 'full']}
      >
        {computer ? (
          <ThisComputer remote={computer} onClose={() => setComputerId(null)} />
        ) : null}
      </BottomSheet>
    </>
  );
}

export function EnvironmentsSettings({
  showHeading = true,
  inlinePairing = false,
}: {
  showHeading?: boolean;
  inlinePairing?: boolean;
}) {
  return (
    <ScrollView
      className="flex-1 bg-background"
      keyboardShouldPersistTaps="handled"
      contentInsetAdjustmentBehavior="automatic"
    >
      <Box
        className="w-full max-w-2xl self-center"
        gap={6}
        paddingX={6}
        paddingY={8}
      >
        <EnvironmentSettingsSection
          presentation="destination"
          showHeading={showHeading}
          inlinePairing={inlinePairing}
        />
      </Box>
    </ScrollView>
  );
}
