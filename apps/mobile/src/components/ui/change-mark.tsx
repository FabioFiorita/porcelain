import { View } from 'react-native';
import { Text } from './text';

export function ChangeMark({ letter }: { letter?: string | undefined }) {
  return letter ? (
    <Text variant="code" tone="brand" weight="medium" accessible={false}>
      {letter}
    </Text>
  ) : (
    <View accessible={false} className="mr-1 size-2 rounded-full bg-brand" />
  );
}
