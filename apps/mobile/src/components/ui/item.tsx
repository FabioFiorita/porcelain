import type { ReactNode } from 'react';
import { Pressable, View } from 'react-native';
import { Text } from './text';
import { itemAccessibilityLabel } from '../../shared/rules/item-label.ts';
const variants = {
  default: 'border-transparent',
  outline: 'border-border',
  muted: 'border-transparent bg-muted/50',
};
const sizes = {
  default: 'gap-3 px-4 py-3',
  sm: 'gap-3 px-3 py-2.5',
  xs: 'gap-2 px-2.5 py-2',
};
export type ItemProps = {
  title: string;
  description?: string;
  leading?: ReactNode;
  trailing?: ReactNode;
  children?: ReactNode;
  variant?: keyof typeof variants;
  size?: keyof typeof sizes;
  selected?: boolean;
  disabled?: boolean;
  onPress?: () => void;
  onLongPress?: () => void;
  accessibilityLabel?: string;
  testID?: string;
};
export function Item({
  title,
  description,
  leading,
  trailing,
  children,
  variant = 'default',
  size = 'default',
  selected = false,
  disabled = false,
  onPress,
  onLongPress,
  accessibilityLabel,
  testID,
}: ItemProps) {
  const className = [
    'min-h-11 flex-row items-center rounded-2xl border',
    variants[variant],
    sizes[size],
    selected ? 'bg-accent' : '',
    disabled ? 'opacity-50' : '',
    onPress || onLongPress ? 'active:bg-muted' : '',
  ]
    .filter(Boolean)
    .join(' ');
  const content = (
    <>
      {leading}
      <View className="min-w-0 flex-1 gap-1">
        <Text variant="ui" weight="medium">
          {title}
        </Text>
        {description ? (
          <Text variant="caption" tone="muted">
            {description}
          </Text>
        ) : null}
        {children}
      </View>
      {trailing}
    </>
  );
  return onPress || onLongPress ? (
    <Pressable
      testID={testID}
      accessibilityRole="button"
      accessibilityLabel={itemAccessibilityLabel({
        title,
        description,
        accessibilityLabel,
        hasAdditionalContent: Boolean(leading || trailing || children),
      })}
      accessibilityState={{ selected, disabled }}
      disabled={disabled}
      onPress={onPress}
      onLongPress={onLongPress}
      className={className}
    >
      {content}
    </Pressable>
  ) : (
    <View testID={testID} className={className}>
      {content}
    </View>
  );
}
