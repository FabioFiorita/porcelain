import { BottomSheet, FieldGroup, Host, ListItem, Text } from '@expo/ui';
import { useState } from 'react';
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
      <Host style={{ flex: 1 }}>
        <FieldGroup>
          <FieldGroup.Section title="Environments">
            {storage.status === 'loading' ? (
              <Text>Reading saved environments…</Text>
            ) : null}
            {storage.error ? <Text>{storage.error}</Text> : null}
            {storage.status === 'ready' && remotes.length === 0 ? (
              <Text>No environments paired.</Text>
            ) : null}
            {remotes.map((remote) => (
              <EnvironmentRow key={remote.environmentId} remote={remote} />
            ))}
            {storage.status === 'unreadable' ? (
              <ListItem onPress={() => read()}>
                Read saved environments again
              </ListItem>
            ) : storage.status === 'ready' ? (
              <ListItem onPress={() => setPairing(true)}>
                Add environment
              </ListItem>
            ) : null}
          </FieldGroup.Section>
        </FieldGroup>
      </Host>
      <BottomSheet isPresented={pairing} onDismiss={() => setPairing(false)}>
        {pairing ? <PairEnvironment onClose={() => setPairing(false)} /> : null}
      </BottomSheet>
    </>
  );
}
