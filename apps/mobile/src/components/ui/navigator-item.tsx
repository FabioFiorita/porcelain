import type { ReactNode } from 'react';
import { Pressable, View } from 'react-native';
import { Text } from './text';

export function NavigatorItem({
  title,
  subtitle,
  detail,
  progress = false,
  leading,
  action,
  phone,
  selected,
  disabled,
  accessibilityLabel,
  onPress,
}: {
  title: string;
  subtitle?: string | undefined;
  detail?: string | undefined;
  progress?: boolean;
  leading: ReactNode;
  action?: ReactNode;
  phone: boolean;
  selected: boolean;
  disabled: boolean;
  accessibilityLabel: string;
  onPress: () => void;
}) {
  return (
    <View
      className={[
        'flex-row items-center rounded-lg',
        selected
          ? phone
            ? 'bg-muted inset-ring-1 inset-ring-border'
            : 'bg-sidebar-row shadow-row'
          : '',
      ].join(' ')}
    >
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={accessibilityLabel}
        accessibilityState={{ selected, disabled }}
        disabled={disabled}
        onPress={onPress}
        className={[
          'min-w-0 flex-1 flex-row items-start gap-2.5 rounded-lg pl-2 active:bg-sidebar-accent',
          subtitle
            ? phone
              ? 'min-h-14.25 py-2.25 pr-3'
              : 'min-h-13 py-1.75 pr-2.5'
            : 'min-h-11 items-center py-2 pr-3',
        ].join(' ')}
      >
        <View
          className={
            phone
              ? 'h-5.25 w-4.5 items-center justify-center'
              : 'h-5 w-4.5 items-center justify-center'
          }
        >
          {leading}
        </View>
        <View className="min-w-0 flex-1">
          <View className="min-w-0 flex-row items-center gap-2.5">
            <Text
              variant="ui"
              weight="medium"
              numberOfLines={1}
              className={
                phone
                  ? 'min-w-0 flex-1 text-base leading-5.25 tracking-[-0.01em]'
                  : 'min-w-0 flex-1 text-sm leading-5'
              }
            >
              {title}
            </Text>
            {detail ? (
              <Text
                variant="ui"
                tone={selected && progress ? 'brand' : 'muted'}
                weight={selected && progress ? 'medium' : 'normal'}
                numberOfLines={1}
                className={[
                  progress
                    ? 'shrink-0 tabular-nums'
                    : 'min-w-0 max-w-1/2 shrink',
                  progress
                    ? phone
                      ? 'text-sm leading-5.25'
                      : 'text-ui leading-5'
                    : 'text-ui leading-4.5',
                ].join(' ')}
              >
                {detail}
              </Text>
            ) : null}
          </View>
          {subtitle ? (
            <Text
              variant="ui"
              tone="muted"
              numberOfLines={1}
              className="leading-4.5"
            >
              {subtitle}
            </Text>
          ) : null}
        </View>
      </Pressable>
      {action}
    </View>
  );
}
