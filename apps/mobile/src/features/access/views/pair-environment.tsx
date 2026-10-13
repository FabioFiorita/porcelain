import { Box } from '../../../components/ui/box';
import { Text } from '../../../components/ui/text';
import { Button } from '../../../components/ui/button';
import { Cause } from 'effect';
import { AsyncResult } from 'effect/reactivity';
import { connectionErrorMessage } from '@porcelain/client/access/rules';
import { RNHostView } from '@expo/ui';
import { useState } from 'react';
import { Input } from '../../../components/ui/input';
import { Field } from '../../../components/ui/field';
import { ErrorState } from '../../../components/ui/error-state';
import { ScrollView } from 'react-native';
import { usePairEnvironment, useReadEnvironments } from '../commands/pairing';
import { useEnvironmentStorageStatus } from '../store';
import { developmentPairingUrl } from '../api';
import { useDevelopmentPairing } from '../commands/development-pairing';

export function PairEnvironment({ onClose }: { onClose: () => void }) {
  const [value, setValue] = useState('');
  const pair = usePairEnvironment(onClose);
  const development = useDevelopmentPairing();
  const storage = useEnvironmentStorageStatus();
  const read = useReadEnvironments();
  const unavailable =
    pair.result.waiting ||
    development.result.waiting ||
    storage.status !== 'ready';
  return (
    <RNHostView>
      <ScrollView
        className="flex-1 bg-background"
        keyboardShouldPersistTaps="handled"
        contentInsetAdjustmentBehavior="automatic"
      >
        <Box gap={4} paddingX={6} paddingY={8}>
          <Text variant="heading">Pair an environment</Text>
          <Field
            label="Pairing link"
            description="Run porcelain pair on the computer you want to connect, then paste the whole link it prints."
          >
            <Input
              testID="pairing-link"
              accessibilityLabel="Pairing link"
              value={value}
              onChangeText={(next) => {
                pair.reset();
                development.reset();
                setValue(next);
              }}
              disabled={unavailable}
              placeholder="Pairing link"
              keyboardType="url"
              autoCapitalize="none"
              autoCorrect={false}
            />
          </Field>
          {__DEV__ && developmentPairingUrl ? (
            <Box gap={2}>
              <Text variant="ui" tone="muted">
                Create a pairing link for this development server, then select
                Pair.
              </Text>
              <Button
                testID="development-pairing-link"
                label={
                  development.result.waiting
                    ? 'Creating pairing link…'
                    : 'Use development server'
                }
                variant="outline"
                pending={development.result.waiting}
                disabled={unavailable}
                onPress={() => {
                  pair.reset();
                  development.request(setValue);
                }}
              />
              {AsyncResult.isFailure(development.result) ? (
                <Text accessibilityRole="alert" variant="ui" tone="destructive">
                  {String(Cause.squash(development.result.cause))}
                </Text>
              ) : null}
            </Box>
          ) : null}
          {storage.error ? (
            <ErrorState
              message={storage.error}
              {...(storage.status === 'unreadable'
                ? {
                    retry: {
                      label: 'Read saved environments again',
                      onPress: () => read(undefined),
                    },
                  }
                : {})}
            />
          ) : null}
          {AsyncResult.isFailure(pair.result) ? (
            <Text accessibilityRole="alert" variant="ui" tone="destructive">
              {connectionErrorMessage(Cause.squash(pair.result.cause))}
            </Text>
          ) : null}
          <Button
            testID="pair-environment"
            label={pair.result.waiting ? 'Pairing…' : 'Pair'}
            pending={pair.result.waiting}
            disabled={unavailable || value.trim() === ''}
            onPress={() => pair.submit(value)}
          />
          <Button
            testID="cancel-pairing"
            label="Cancel"
            variant="ghost"
            onPress={onClose}
          />
        </Box>
      </ScrollView>
    </RNHostView>
  );
}
