import { View } from 'react-native';
import { Text } from './text';

const variants = {
  list: { row: 'min-h-9 px-4 pb-1.5 pt-3', tone: 'muted' },
  section: { row: 'min-h-6 pb-2', tone: 'default' },
} as const;

export function GroupHeader({
  label,
  count,
  variant = 'list',
}: {
  label: string;
  count?: number | undefined;
  variant?: keyof typeof variants;
}) {
  return (
    <View
      accessible
      accessibilityRole="header"
      accessibilityLabel={`${label}${count === undefined ? '' : ` · ${count}`}`}
      className={`flex-row items-end gap-2 ${variants[variant].row}`}
    >
      <Text
        accessible={false}
        variant="secondary"
        weight="medium"
        tone={variants[variant].tone}
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
