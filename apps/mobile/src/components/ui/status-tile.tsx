import { View } from 'react-native';
import { Icon, type IconName } from './icon';

const tones = {
  brand: { surface: 'bg-brand-soft', icon: 'brand' },
  add: { surface: 'bg-add-bg', icon: 'add' },
  warn: { surface: 'bg-warn-soft', icon: 'muted' },
  muted: { surface: 'bg-foreground/10', icon: 'muted' },
} as const;

export function StatusTile({
  name,
  tone,
}: {
  name: IconName;
  tone: keyof typeof tones;
}) {
  return (
    <View
      accessible={false}
      className={`size-10 items-center justify-center rounded-full ${tones[tone].surface}`}
    >
      <Icon name={name} tone={tones[tone].icon} />
    </View>
  );
}
