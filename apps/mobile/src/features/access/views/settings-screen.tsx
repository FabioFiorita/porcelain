import { BottomSheet, Button, Host } from '@expo/ui';
import { useState } from 'react';
import { ScrollView, Text, View } from 'react-native';
import { useReadEnvironments } from '../commands/pairing';
import { useEnvironments, useEnvironmentStorageStatus } from '../store';
import { EnvironmentRow } from './environment-row';
import { PairEnvironment } from './pair-environment';

export function SettingsScreen() {
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
          <Text
            accessibilityRole="header"
            className="text-xl font-semibold text-foreground"
          >
            Settings
          </Text>
          <View className="gap-3">
            <Text
              accessibilityRole="header"
              className="text-sm font-medium text-muted-foreground"
            >
              Environments
            </Text>
            {storage.status === 'loading' ? (
              <Text className="text-sm text-muted-foreground">
                Reading saved environments…
              </Text>
            ) : null}
            {storage.error ? (
              <Text className="text-sm text-destructive">{storage.error}</Text>
            ) : null}
            {storage.status === 'ready' && remotes.length === 0 ? (
              <Text className="text-sm text-muted-foreground">
                No environments paired.
              </Text>
            ) : null}
            {remotes.length > 0 ? (
              <View className="overflow-hidden rounded-lg border border-border bg-card">
                {remotes.map((remote) => (
                  <EnvironmentRow key={remote.environmentId} remote={remote} />
                ))}
              </View>
            ) : null}
            <Host matchContents={{ vertical: true }}>
              {storage.status === 'unreadable' ? (
                <Button
                  variant="text"
                  label="Read saved environments again"
                  onPress={() => read(undefined)}
                />
              ) : storage.status === 'ready' ? (
                <Button
                  testID="add-environment"
                  variant="text"
                  label="Add environment"
                  onPress={() => setPairing(true)}
                />
              ) : null}
            </Host>
          </View>
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
