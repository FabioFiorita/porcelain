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
import { useEnvironments, useEnvironmentStorageStatus } from '../store';
import { EnvironmentRow } from './environment-row';
import { PairEnvironment } from './pair-environment';
import { PairEnvironmentForm } from './pair-environment-form';

export function EnvironmentSettingsSection({
  presentation = 'overview',
  showHeading = true,
}: {
  presentation?: 'overview' | 'destination';
  showHeading?: boolean;
}) {
  const [pairing, setPairing] = useState(false);
  const remotes = useEnvironments();
  const storage = useEnvironmentStorageStatus();
  const read = useReadEnvironments();
  const nativeAdd = presentation === 'destination' && !showHeading;
  return (
    <>
      {nativeAdd ? (
        <Stack.Toolbar placement="right">
          <Stack.Toolbar.Button
            icon={headerIcon('add')}
            accessibilityLabel="Add environment"
            disabled={storage.status !== 'ready'}
            onPress={() => setPairing(true)}
          />
        </Stack.Toolbar>
      ) : null}
      <Box gap={3}>
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
              Environments
            </Text>
            <Button
              testID="add-environment"
              className="max-w-full"
              variant="outline"
              label="Add environment"
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
        {presentation === 'destination' && pairing ? (
          <Card padding={4}>
            <PairEnvironmentForm onClose={() => setPairing(false)} />
          </Card>
        ) : null}
        {storage.status === 'loading' ? (
          <Loading label="Reading saved environments…" />
        ) : null}
        {storage.error ? <ErrorState message={storage.error} /> : null}
        {storage.status === 'ready' && remotes.length === 0 ? (
          <Card gap={2} padding={4}>
            <Text variant="ui" weight="medium">
              No environments paired.
            </Text>
            <Text variant="caption" tone="muted">
              Select Add environment to connect to a computer running Porcelain
              with its pairing link.
            </Text>
          </Card>
        ) : null}
        {remotes.length > 0 ? (
          <Card className="overflow-hidden">
            {remotes.map((remote, index) => (
              <Fragment key={remote.environmentId}>
                {index > 0 ? <Separator /> : null}
                <EnvironmentRow
                  remote={remote}
                  disabled={storage.status !== 'ready'}
                />
              </Fragment>
            ))}
          </Card>
        ) : null}
        {storage.status === 'unreadable' ? (
          <Button
            variant="outline"
            label="Read saved environments again"
            onPress={() => read(undefined)}
          />
        ) : null}
      </Box>
      {presentation === 'overview' ? (
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
    </>
  );
}

export function EnvironmentsSettings({
  showHeading = true,
}: {
  showHeading?: boolean;
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
        />
      </Box>
    </ScrollView>
  );
}
