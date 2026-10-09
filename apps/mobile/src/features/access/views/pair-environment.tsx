import { Text } from '../../../components/ui/text';
import { Button } from '../../../components/ui/button';
import { Cause } from 'effect';
import { AsyncResult } from 'effect/reactivity';
import { connectionErrorMessage } from '@porcelain/client/access/rules';
import { RNHostView } from '@expo/ui';
import { useState } from 'react';
import { Input } from '../../../components/ui/input';
import { Field } from '../../../components/ui/field';
import { ScrollView, View } from 'react-native';
import { usePairEnvironment } from '../commands/pairing';

export function PairEnvironment({ onClose }: { onClose: () => void }) {
  const [value, setValue] = useState('');
  const pair = usePairEnvironment(onClose);
  return (
    <RNHostView>
      <ScrollView
        className="flex-1 bg-background"
        keyboardShouldPersistTaps="handled"
        contentInsetAdjustmentBehavior="automatic"
      >
        <View className="gap-4 px-6 py-8">
          <Text variant="heading">Pair an environment</Text>
          <Field
            label="Pairing link"
            description="Paste the link from the computer you want to connect."
          >
            <Input
              testID="pairing-link"
              accessibilityLabel="Pairing link"
              value={value}
              onChangeText={setValue}
              disabled={pair.result.waiting}
              placeholder="Pairing link"
              keyboardType="url"
              autoCapitalize="none"
              autoCorrect={false}
            />
          </Field>
          {AsyncResult.isFailure(pair.result) ? (
            <Text accessibilityRole="alert" variant="ui" tone="destructive">
              {connectionErrorMessage(Cause.squash(pair.result.cause))}
            </Text>
          ) : null}
          <Button
            testID="pair-environment"
            label={pair.result.waiting ? 'Pairing…' : 'Pair'}
            pending={pair.result.waiting}
            onPress={() => pair.submit(value)}
          />
          <Button
            testID="cancel-pairing"
            label="Cancel"
            variant="ghost"
            onPress={onClose}
          />
        </View>
      </ScrollView>
    </RNHostView>
  );
}
