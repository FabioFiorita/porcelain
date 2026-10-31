import { View } from 'react-native';
import { Text } from './text';

export function GroupHeader({
  label,
  count,
}: {
  label: string;
  count?: number | undefined;
}) {
  return (
    <View
      accessible
      accessibilityRole="header"
      accessibilityLabel={`${label}${count === undefined ? '' : ` · ${count}`}`}
      className="min-h-8 flex-row items-center gap-2 px-2.5 py-1"
    >
      <Text
        accessible={false}
        variant="subheading"
        tone="muted"
        className="flex-1"
      >
        {label}
      </Text>
      {count === undefined ? null : (
        <Text accessible={false} variant="subheading" tone="muted">
          {count}
        </Text>
      )}
    </View>
  );
}
