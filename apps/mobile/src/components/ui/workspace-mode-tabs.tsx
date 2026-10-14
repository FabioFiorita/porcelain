import { useState } from 'react';
import { Pressable, View } from 'react-native';
import { Text } from './text';

const modes = [
  { value: 'files', label: 'Files' },
  { value: 'review', label: 'Review' },
  { value: 'history', label: 'History' },
] as const;

type WorkspaceMode = (typeof modes)[number]['value'];

export function WorkspaceModeTabs({
  value,
  onChange,
}: {
  value: WorkspaceMode;
  onChange: (value: WorkspaceMode) => void;
}) {
  const [hovered, setHovered] = useState<WorkspaceMode>();
  return (
    <View
      accessibilityRole="tablist"
      accessibilityLabel="Workspace mode"
      className="min-w-0 flex-1 flex-row items-center justify-center gap-1 rounded-2xl bg-muted/50 p-1"
    >
      {modes.map((mode) => (
        <Pressable
          key={mode.value}
          accessibilityRole="tab"
          accessibilityLabel={mode.label}
          accessibilityState={{ selected: value === mode.value }}
          testID={`workspace-mode-${mode.value}`}
          onPress={() => onChange(mode.value)}
          onPointerEnter={({ nativeEvent }) => {
            if (nativeEvent.pointerType !== 'touch') setHovered(mode.value);
          }}
          onPointerLeave={() => setHovered(undefined)}
          className={[
            'min-h-11 min-w-11 flex-1 items-center justify-center rounded-xl border px-2 py-2 active:opacity-60 focus:border-ring',
            value === mode.value
              ? hovered === mode.value
                ? 'border-border bg-accent'
                : 'border-border bg-background'
              : hovered === mode.value
                ? 'border-transparent bg-muted'
                : 'border-transparent',
          ].join(' ')}
        >
          <Text
            accessible={false}
            variant="ui"
            weight="medium"
            tone={value === mode.value ? 'default' : 'muted'}
            className="text-center"
            numberOfLines={1}
          >
            {mode.label}
          </Text>
        </Pressable>
      ))}
    </View>
  );
}
