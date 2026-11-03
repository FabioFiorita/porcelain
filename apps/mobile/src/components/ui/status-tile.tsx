import { View } from 'react-native';
import { Icon, type IconName } from './icon';
import { Text } from './text';

const tones = {
  brand: { surface: 'bg-brand-soft', icon: 'brand' },
  add: { surface: 'bg-add-bg', icon: 'add' },
  warn: { surface: 'bg-warn-soft', icon: 'muted' },
  muted: { surface: 'bg-foreground/10', icon: 'muted' },
} as const;

export function StatusTile({
  tone,
  ...mark
}: { tone: keyof typeof tones } & ({ name: IconName } | { label: string })) {
  return (
    <View
      accessible={false}
      className={`size-10 items-center justify-center rounded-full ${tones[tone].surface}`}
    >
      {'name' in mark ? (
        <Icon name={mark.name} tone={tones[tone].icon} />
      ) : (
        <Text variant="secondary" weight="semibold" tone={tones[tone].icon}>
          {mark.label}
        </Text>
      )}
    </View>
  );
}
