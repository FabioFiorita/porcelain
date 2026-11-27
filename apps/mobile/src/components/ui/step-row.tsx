import { Pressable, View } from 'react-native';
import { hitHeight } from './hit-target';
import { usePressRipple } from './press-ripple';
import { StateIcon, type RunState } from './state-icon';
import { Text } from './text';

const names = {
  pending: { tone: 'muted', weight: 'normal' },
  skipped: { tone: 'muted', weight: 'normal' },
  failed: { tone: 'del', weight: 'medium' },
  running: { tone: 'default', weight: 'medium' },
  passed: { tone: 'default', weight: 'normal' },
} as const;

export function StepRow({
  number,
  name,
  state,
  detail,
  expanded,
  accessibilityLabel,
  onPress,
}: {
  number: number;
  name: string;
  state: RunState;
  detail?: string | undefined;
  expanded?: boolean | undefined;
  accessibilityLabel?: string | undefined;
  onPress?: (() => void) | undefined;
}) {
  const ripple = usePressRipple('bounded');
  const content = (
    <>
      <Text variant="caption" tone="muted" className="w-5 text-right">
        {number}
      </Text>
      <StateIcon state={state} />
      <Text
        variant="secondary"
        tone={names[state].tone}
        weight={names[state].weight}
        numberOfLines={1}
        className="min-w-0 flex-1"
      >
        {name}
      </Text>
      {detail ? (
        <Text variant="caption" tone="muted">
          {detail}
        </Text>
      ) : null}
    </>
  );
  const row = 'flex-row items-center gap-2 px-1';
  return onPress ? (
    <Pressable
      {...(ripple ? { android_ripple: ripple } : {})}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? name}
      accessibilityState={{ expanded }}
      onPress={onPress}
      className={`${row} ${hitHeight} active:bg-accent`}
    >
      {content}
    </Pressable>
  ) : (
    <View className={`${row} min-h-8`}>{content}</View>
  );
}
