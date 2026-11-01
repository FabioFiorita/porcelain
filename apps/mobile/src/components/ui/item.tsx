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
  default: 'gap-2.5 px-3 py-2.5',
  sm: 'gap-2.5 px-3 py-2.5',
  xs: 'gap-2 px-2.5 py-2',
};
export type ItemProps = {
  title: string;
  description?: string;
  titleNumberOfLines?: number;
  titleDecoration?: 'line-through' | undefined;
  descriptionNumberOfLines?: number;
  titleTrailing?: ReactNode;
  detail?: string;
  leading?: ReactNode;
  trailing?: ReactNode;
  action?: ReactNode;
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
  titleNumberOfLines,
  titleDecoration,
  descriptionNumberOfLines,
  titleTrailing,
  detail,
  leading,
  trailing,
  action,
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
    'min-h-11 flex-row items-center rounded-md border',
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
      <View className="w-0 min-w-0 flex-1 shrink gap-1">
        {titleTrailing || detail ? (
          <View className="w-full min-w-0 flex-row items-center gap-2">
            <Text
              variant="ui"
              weight="medium"
              numberOfLines={titleNumberOfLines}
              className="w-0 min-w-0 flex-1"
              decoration={titleDecoration}
            >
              {title}
            </Text>
            {detail ? (
              <Text
                variant="code"
                tone="muted"
                numberOfLines={1}
                ellipsizeMode="head"
                className="min-w-0 max-w-1/2 shrink"
              >
                {detail}
              </Text>
            ) : null}
            {titleTrailing}
          </View>
        ) : (
          <Text
            variant="ui"
            weight="medium"
            numberOfLines={titleNumberOfLines}
            decoration={titleDecoration}
          >
            {title}
          </Text>
        )}
        {description ? (
          <Text
            variant="caption"
            tone="muted"
            numberOfLines={descriptionNumberOfLines}
          >
            {description}
          </Text>
        ) : null}
        {children}
      </View>
      {trailing}
    </>
  );
  const row =
    onPress || onLongPress ? (
      <Pressable
        testID={testID}
        accessibilityRole="button"
        accessibilityLabel={itemAccessibilityLabel({
          title,
          description,
          accessibilityLabel,
          hasAdditionalContent: Boolean(
            leading || trailing || titleTrailing || detail || children,
          ),
        })}
        accessibilityState={{ selected, disabled }}
        disabled={disabled}
        onPress={onPress}
        onLongPress={onLongPress}
        className={
          action ? 'min-w-0 flex-1 flex-row items-center gap-3' : className
        }
      >
        {content}
      </Pressable>
    ) : (
      <View testID={testID} className={className}>
        {content}
      </View>
    );
  return action ? (
    <View className={className}>
      {row}
      {action}
    </View>
  ) : (
    row
  );
}
