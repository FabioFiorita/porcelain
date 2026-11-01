import { View } from 'react-native';

const tones = {
  add: 'bg-add-fg',
  del: 'bg-del-fg',
  warning: 'bg-graph-4',
  info: 'bg-graph-1',
  muted: 'bg-muted-foreground',
};

export function StatusDot({
  label,
  tone,
}: {
  label: string;
  tone: keyof typeof tones;
}) {
  return (
    <View
      accessible
      accessibilityRole="image"
      accessibilityLabel={label}
      className="w-3.5 items-center justify-center"
    >
      <View className={`size-1.5 rounded-full ${tones[tone]}`} />
    </View>
  );
}
