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
      className="min-h-9 flex-row items-end gap-2 px-4 pb-1.5 pt-3"
    >
      <Text
        accessible={false}
        variant="secondary"
        weight="medium"
        tone="muted"
        className="flex-1"
      >
        {label}
      </Text>
      {count === undefined ? null : (
        <Text accessible={false} variant="secondary" tone="muted">
          {count}
        </Text>
      )}
    </View>
  );
}
