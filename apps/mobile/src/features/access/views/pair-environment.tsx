import { Cause } from 'effect';
import { AsyncResult } from 'effect/reactivity';
import { connectionErrorMessage } from '@porcelain/client/access/rules';
import { Button, Host, RNHostView, TextInput, useNativeState } from '@expo/ui';
import { ScrollView, Text, View } from 'react-native';
import { usePairEnvironment } from '../commands/pairing';

export function PairEnvironment({ onClose }: { onClose: () => void }) {
  const value = useNativeState('');
  const pair = usePairEnvironment(onClose);
  return (
    <RNHostView>
      <ScrollView
        className="flex-1 bg-background"
        keyboardShouldPersistTaps="handled"
        contentInsetAdjustmentBehavior="automatic"
      >
        <View className="gap-4 px-6 py-8">
          <Text
            accessibilityRole="header"
            className="text-xl font-semibold text-foreground"
          >
            Pair an environment
          </Text>
          <Host matchContents={{ vertical: true }}>
            <TextInput
              testID="pairing-link"
              value={value}
              placeholder="Pairing link"
              keyboardType="url"
              autoCapitalize="none"
              autoCorrect={false}
            />
          </Host>
          {AsyncResult.isFailure(pair.result) ? (
            <Text
              accessibilityRole="alert"
              className="text-sm text-destructive"
            >
              {connectionErrorMessage(Cause.squash(pair.result.cause))}
            </Text>
          ) : null}
          <Host matchContents={{ vertical: true }}>
            <Button
              testID="pair-environment"
              label={pair.result.waiting ? 'Pairing…' : 'Pair'}
              disabled={pair.result.waiting}
              onPress={() => pair.submit(value.get())}
            />
          </Host>
          <Host matchContents={{ vertical: true }}>
            <Button
              testID="cancel-pairing"
              label="Cancel"
              variant="text"
              onPress={onClose}
            />
          </Host>
        </View>
      </ScrollView>
    </RNHostView>
  );
}
