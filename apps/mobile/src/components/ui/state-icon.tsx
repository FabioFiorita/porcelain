import { ActivityIndicator, View } from 'react-native';
import { Icon } from './icon';

export type RunState = 'failed' | 'running' | 'passed' | 'skipped' | 'pending';

const states = {
  failed: { icon: 'failed', tone: 'del', label: 'Failed' },
  passed: { icon: 'passed', tone: 'add', label: 'Passed' },
  skipped: { icon: 'neutral', tone: 'muted', label: 'Skipped' },
  pending: { icon: 'pending', tone: 'muted', label: 'Waiting' },
} as const;

export function StateIcon({
  state,
  label,
}: {
  state: RunState;
  label?: string | undefined;
}) {
  return (
    <View
      accessible
      accessibilityRole="image"
      accessibilityLabel={
        label ?? (state === 'running' ? 'Running' : states[state].label)
      }
      className="size-4 items-center justify-center"
    >
      {state === 'running' ? (
        <ActivityIndicator
          size="small"
          className="scale-75"
          colorClassName="accent-foreground"
        />
      ) : (
        <Icon
          name={states[state].icon}
          tone={states[state].tone}
          size="small"
        />
      )}
    </View>
  );
}
