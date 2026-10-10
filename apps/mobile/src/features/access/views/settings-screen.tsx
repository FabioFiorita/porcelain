import { Card } from '../../../components/ui/card';
import { Box } from '../../../components/ui/box';
import { Text } from '../../../components/ui/text';
import { Button } from '../../../components/ui/button';
import { Loading } from '../../../components/ui/loading';
import { ErrorState } from '../../../components/ui/error-state';
import { Separator } from '../../../components/ui/separator';
import { Item } from '../../../components/ui/item';
import { Fragment, useState } from 'react';
import { BottomSheet } from '@expo/ui';
import { ScrollView } from 'react-native';
import { useReadEnvironments } from '../commands/pairing';
import { useEnvironments, useEnvironmentStorageStatus } from '../store';
import { EnvironmentRow } from './environment-row';
import { PairEnvironment } from './pair-environment';
import { SettingsToolbar, settingsHeaderVisible } from './settings-toolbar';

export function SettingsScreen({
  onOpenAppearance,
  onOpenComponentLibrary,
}: {
  onOpenAppearance?: () => void;
  onOpenComponentLibrary?: () => void;
}) {
  const [pairing, setPairing] = useState(false);
  const remotes = useEnvironments();
  const storage = useEnvironmentStorageStatus();
  const read = useReadEnvironments();
  return (
    <>
      <SettingsToolbar
        disabled={storage.status !== 'ready'}
        onAdd={() => setPairing(true)}
      />
      <ScrollView
        className="flex-1 bg-background"
        contentInsetAdjustmentBehavior="automatic"
      >
        <Box gap={6} paddingX={6} paddingY={8}>
          {settingsHeaderVisible ? null : (
            <Text variant="heading">Settings</Text>
          )}
          {onOpenAppearance ? (
            <Item
              title="Appearance"
              description="Theme, code and documents"
              variant="outline"
              onPress={onOpenAppearance}
            />
          ) : null}
          <Box gap={3}>
            <Text variant="subheading" tone="muted">
              Environments
            </Text>
            {storage.status === 'loading' ? (
              <Loading label="Reading saved environments…" />
            ) : null}
            {storage.error ? <ErrorState message={storage.error} /> : null}
            {storage.status === 'ready' && remotes.length === 0 ? (
              <Text variant="ui" tone="muted">
                No environments paired.
              </Text>
            ) : null}
            {remotes.length > 0 ? (
              <Card className="overflow-hidden">
                {remotes.map((remote, index) => (
                  <Fragment key={remote.environmentId}>
                    {index > 0 ? <Separator /> : null}
                    <EnvironmentRow
                      key={remote.environmentId}
                      remote={remote}
                      disabled={storage.status !== 'ready'}
                    />
                  </Fragment>
                ))}
              </Card>
            ) : null}
            {(() => {
              if (storage.status === 'unreadable') {
                return (
                  <Button
                    variant="outline"
                    label="Read saved environments again"
                    onPress={() => read(undefined)}
                  />
                );
              }
              if (storage.status === 'ready' && !settingsHeaderVisible) {
                return (
                  <Button
                    testID="add-environment"
                    variant="outline"
                    label="Add environment"
                    onPress={() => setPairing(true)}
                  />
                );
              }
              return null;
            })()}
          </Box>
          {__DEV__ && onOpenComponentLibrary ? (
            <Box gap={3}>
              <Text variant="subheading" tone="muted">
                Development
              </Text>
              <Button
                label="Component library"
                variant="outline"
                onPress={onOpenComponentLibrary}
              />
            </Box>
          ) : null}
        </Box>
      </ScrollView>
      <BottomSheet
        isPresented={pairing}
        onDismiss={() => setPairing(false)}
        contentPadding={0}
        snapPoints={['half', 'full']}
      >
        {pairing ? <PairEnvironment onClose={() => setPairing(false)} /> : null}
      </BottomSheet>
    </>
  );
}
