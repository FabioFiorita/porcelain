import type { ReactNode } from 'react';
import { Pressable, View } from 'react-native';
import { hitHeight } from './hit-target';
import { usePressRipple } from './press-ripple';
import { Text } from './text';
import { itemAccessibilityLabel } from '../../shared/rules/item-label.ts';
const sizes = {
  default: { row: 'gap-3 px-4 py-3', oneLine: 'min-h-12', twoLine: 'min-h-16' },
  compact: {
    row: 'gap-2.5 px-3 py-2',
    oneLine: hitHeight,
    twoLine: 'min-h-14',
  },
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
  size?: keyof typeof sizes;
  selected?: boolean;
  highlighted?: boolean;
  selectionTone?: 'brand' | 'neutral';
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
  size = 'default',
  selected = false,
  highlighted = false,
  selectionTone = 'brand',
  disabled = false,
  onPress,
  onLongPress,
  accessibilityLabel,
  testID,
}: ItemProps) {
  const ripple = usePressRipple('bounded');
  const pressable = Boolean(onPress || onLongPress);
  const className = [
    'flex-row items-center',
    sizes[size].row,
    description || children ? sizes[size].twoLine : sizes[size].oneLine,
    highlighted ? 'rounded-md bg-accent' : '',
    selected && !highlighted && selectionTone === 'brand'
      ? 'bg-brand-soft'
      : '',
    selected && !highlighted && selectionTone === 'neutral'
      ? 'rounded-md bg-muted'
      : '',
    disabled ? 'opacity-50' : '',
    pressable ? 'active:bg-accent' : '',
  ]
    .filter(Boolean)
    .join(' ');
  const content = (
    <>
      {leading}
      <View className="w-0 min-w-0 flex-1 shrink gap-0.5">
        {titleTrailing || detail ? (
          <View className="w-full min-w-0 flex-row items-center gap-2">
            <Text
              variant="body"
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
            variant="body"
            weight="medium"
            numberOfLines={titleNumberOfLines}
            decoration={titleDecoration}
          >
            {title}
          </Text>
        )}
        {description ? (
          <Text
            variant="secondary"
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
  const row = pressable ? (
    <Pressable
      {...(ripple ? { android_ripple: ripple } : {})}
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
