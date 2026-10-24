import { View } from 'react-native';
import { Icon, type IconName } from './icon';

export function IconTile({ name }: { name: IconName }) {
  return (
    <View className="size-8 items-center justify-center rounded-lg border border-border bg-muted">
      <Icon name={name} />
    </View>
  );
}
