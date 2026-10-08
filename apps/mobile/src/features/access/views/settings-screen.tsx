import { Text } from '../../../components/ui/text';
import { Button } from '../../../components/ui/button';
import { Loading } from '../../../components/ui/loading';
import { ErrorState } from '../../../components/ui/error-state';
import { Separator } from '../../../components/ui/separator';
import { Fragment } from 'react';
import { BottomSheet } from '@expo/ui';
import { useState } from 'react';
import { ScrollView, View } from 'react-native';
import { useReadEnvironments } from '../commands/pairing';
import { useEnvironments, useEnvironmentStorageStatus } from '../store';
import { EnvironmentRow } from './environment-row';
import { PairEnvironment } from './pair-environment';

export function SettingsScreen({
  onOpenComponentLibrary,
}: {
  onOpenComponentLibrary?: () => void;
}) {
  const [pairing, setPairing] = useState(false);
  const remotes = useEnvironments();
  const storage = useEnvironmentStorageStatus();
  const read = useReadEnvironments();
  return (
    <>
      <ScrollView
        className="flex-1 bg-background"
        contentInsetAdjustmentBehavior="automatic"
      >
        <View className="gap-6 px-6 py-8">
          <Text variant="heading">Settings</Text>
          <View className="gap-3">
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
              <View className="overflow-hidden rounded-lg border border-border bg-card">
                {remotes.map((remote, index) => (
                  <Fragment key={remote.environmentId}>
                    {index > 0 ? <Separator /> : null}
                    <EnvironmentRow
                      key={remote.environmentId}
                      remote={remote}
                    />
                  </Fragment>
                ))}
              </View>
            ) : null}
            {storage.status === 'unreadable' ? (
              <Button
                variant="outline"
                label="Read saved environments again"
                onPress={() => read(undefined)}
              />
            ) : storage.status === 'ready' ? (
              <Button
                testID="add-environment"
                variant="outline"
                label="Add environment"
                onPress={() => setPairing(true)}
              />
            ) : null}
          </View>
          {__DEV__ && onOpenComponentLibrary ? (
            <View className="gap-3">
              <Text variant="subheading" tone="muted">
                Development
              </Text>
              <Button
                label="Component library"
                variant="outline"
                onPress={onOpenComponentLibrary}
              />
            </View>
          ) : null}
        </View>
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
