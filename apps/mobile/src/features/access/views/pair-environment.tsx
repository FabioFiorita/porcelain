import { Button, Column, Text, TextInput, useNativeState } from '@expo/ui';
import { usePairEnvironment } from '../commands/pairing';

export function PairEnvironment({ onClose }: { onClose: () => void }) {
  const value = useNativeState('');
  const pair = usePairEnvironment(onClose);
  return (
    <Column style={{ padding: 20 }}>
      <Text>Pair an environment</Text>
      <TextInput
        value={value}
        placeholder="Pairing link"
        keyboardType="url"
        autoCapitalize="none"
        autoCorrect={false}
      />
      {pair.error ? <Text>{pair.error.message}</Text> : null}
      <Button
        label={pair.isPending ? 'Pairing…' : 'Pair'}
        disabled={pair.isPending}
        onPress={() => pair.submit(value.get())}
      />
      <Button label="Cancel" variant="text" onPress={onClose} />
    </Column>
  );
}
