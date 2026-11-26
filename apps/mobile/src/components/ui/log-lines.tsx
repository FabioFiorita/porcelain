import { View } from 'react-native';
import { Text } from './text';

export type LogLine = {
  readonly text: string;
  readonly level: 'plain' | 'error' | 'warning' | 'group' | 'command';
};

const levels = {
  plain: { row: '', tone: 'default', weight: 'normal' },
  error: { row: 'bg-del-bg', tone: 'del', weight: 'normal' },
  warning: { row: '', tone: 'default', weight: 'medium' },
  group: { row: '', tone: 'default', weight: 'semibold' },
  command: { row: '', tone: 'muted', weight: 'normal' },
} as const;

export function LogLines({
  lines,
  label,
}: {
  lines: readonly LogLine[];
  label: string;
}) {
  return (
    <View accessible accessibilityLabel={label} className="py-1.5">
      {lines.map((line, index) => (
        <View key={index} className={`px-2.5 ${levels[line.level].row}`}>
          <Text
            variant="mono"
            tone={levels[line.level].tone}
            weight={levels[line.level].weight}
            selectable
          >
            {line.text || ' '}
          </Text>
        </View>
      ))}
    </View>
  );
}
