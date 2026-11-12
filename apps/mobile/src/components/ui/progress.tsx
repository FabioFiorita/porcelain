import { View } from 'react-native';

export function Progress({
  value,
  total,
  label,
  accessibilityLabel,
}: {
  value: number;
  total: number;
  label: string;
  accessibilityLabel: string;
}) {
  return (
    <View
      accessibilityRole="progressbar"
      accessibilityLabel={accessibilityLabel}
      accessibilityValue={{ min: 0, max: total, now: value, text: label }}
      className="flex-row gap-1"
    >
      {Array.from({ length: total }, (_, index) => (
        <View
          key={index}
          className={`h-1.5 flex-1 rounded-full ${index < value ? 'bg-primary' : 'bg-muted'}`}
        />
      ))}
    </View>
  );
}
