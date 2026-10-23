import { Box } from '../../../components/ui/box';
import { Text } from '../../../components/ui/text';
import { Button } from '../../../components/ui/button';
import { Cause } from 'effect';
import { AsyncResult } from 'effect/reactivity';
import { connectionErrorMessage } from '@porcelain/client/access/rules';
import { useState, type ReactNode } from 'react';
import { Input } from '../../../components/ui/input';
import { Field } from '../../../components/ui/field';
import { ErrorState } from '../../../components/ui/error-state';
import { usePairEnvironment, useReadEnvironments } from '../commands/pairing';
import { useEnvironmentStorageStatus } from '../store';

export function PairEnvironmentFields({
  onClose,
  environmentId,
  development,
}: {
  onClose: () => void;
  environmentId?: string;
  development?: {
    waiting: boolean;
    reset: () => void;
    renderControl: (input: {
      disabled: boolean;
      onStart: () => void;
      onLink: (link: string) => void;
    }) => ReactNode;
  };
}) {
  const [value, setValue] = useState('');
  const pair = usePairEnvironment(onClose, environmentId);
  const storage = useEnvironmentStorageStatus();
  const read = useReadEnvironments();
  const unavailable =
    pair.result.waiting || development?.waiting || storage.status !== 'ready';
  return (
    <Box gap={4}>
      <Text variant="heading">
        {environmentId ? 'Add a connection' : 'Pair a computer'}
      </Text>
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
            development?.reset();
            setValue(next);
          }}
          disabled={unavailable}
          placeholder="Pairing link"
          keyboardType="url"
          autoCapitalize="none"
          autoCorrect={false}
        />
      </Field>
      {development?.renderControl({
        disabled: unavailable,
        onStart: pair.reset,
        onLink: setValue,
      })}
      {storage.error ? (
        <ErrorState
          message={storage.error}
          {...(storage.status === 'unreadable'
            ? {
                retry: {
                  label: 'Try again',
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
  );
}
