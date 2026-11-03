import { Fragment } from 'react';
import { Stack } from 'expo-router';
import { ScrollView } from 'react-native';
import { Box } from '../../../components/ui/box';
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

type EnvironmentsSettingsProps = {
  onAddComputer: () => void;
  onOpenComputer: (environmentId: string) => void;
};

function EnvironmentSettingsSection({
  onAddComputer,
  onOpenComputer,
}: EnvironmentsSettingsProps) {
  const remotes = useEnvironments();
  const missing = useMissingCredentials();
  const storage = useEnvironmentStorageStatus();
  const read = useReadEnvironments();
  return (
    <>
      <Stack.Toolbar placement="right">
        <Stack.Toolbar.Button
          icon={headerIcon('add')}
          accessibilityLabel="Add computer"
          disabled={storage.status !== 'ready'}
          onPress={onAddComputer}
        />
      </Stack.Toolbar>
      <Box gap={3}>
        <ComputerUpdatesSummary />
        <Text variant="caption" tone="muted">
          Manage the computers connected to Porcelain.
        </Text>
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
            <Text variant="secondary" weight="medium">
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
                  onOpenComputer={() => onOpenComputer(remote.environmentId)}
                />
              </Fragment>
            ))}
          </Card>
        ) : null}
      </Box>
    </>
  );
}

export function EnvironmentsSettings(props: EnvironmentsSettingsProps) {
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
        <EnvironmentSettingsSection {...props} />
      </Box>
    </ScrollView>
  );
}
