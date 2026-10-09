import { View } from 'react-native';
import { Text } from './text';
import { Icon, type IconName } from './icon';
import { Button } from './button';
export function Empty({
  title,
  description,
  icon,
  action,
}: {
  title: string;
  description: string;
  icon?: IconName;
  action?: { label: string; onPress: () => void } | undefined;
}) {
  return (
    <View className="flex-1 items-center justify-center bg-background px-6 py-8">
      <View className="w-full max-w-sm items-center gap-3">
        {icon ? (
          <View className="items-center justify-center rounded-xl bg-muted p-3">
            <Icon name={icon} size="large" />
          </View>
        ) : null}
        <Text variant="heading" className="text-center">
          {title}
        </Text>
        <Text variant="ui" tone="muted" className="text-center">
          {description}
        </Text>
        {action ? (
          <Button
            label={action.label}
            onPress={action.onPress}
            variant="outline"
          />
        ) : null}
      </View>
    </View>
  );
}
