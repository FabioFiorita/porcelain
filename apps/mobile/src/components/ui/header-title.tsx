import { Pressable, View } from 'react-native';
import { headerTitleText, useHeaderTitleFrame } from './header-title-frame';
import { Icon } from './icon';
import { Text } from './text';

const headerFontScale = 1.5;

export function HeaderTitle({
  title,
  subtitle,
  trailingItems,
  onPress,
  accessibilityLabel,
  accessibilityHint,
  testID,
}: {
  title: string;
  subtitle?: string | undefined;
  trailingItems: number;
  onPress?: (() => void) | undefined;
  accessibilityLabel?: string | undefined;
  accessibilityHint?: string | undefined;
  testID?: string | undefined;
}) {
  const frame = useHeaderTitleFrame(trailingItems);
  const text = (
    <View className="min-w-0 shrink">
      <Text
        {...headerTitleText}
        numberOfLines={1}
        ellipsizeMode="middle"
        maxFontSizeMultiplier={headerFontScale}
      >
        {title}
      </Text>
      {subtitle ? (
        <Text
          variant="caption"
          tone="muted"
          numberOfLines={1}
          ellipsizeMode="head"
          maxFontSizeMultiplier={headerFontScale}
        >
          {subtitle}
        </Text>
      ) : null}
    </View>
  );
  if (!onPress)
    return (
      <View className={frame.className} style={frame.style}>
        {text}
      </View>
    );
  return (
    <Pressable
      testID={testID}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? title}
      accessibilityHint={accessibilityHint}
      hitSlop={8}
      onPress={onPress}
      className={`${frame.className} flex-row items-center gap-1 active:opacity-60`}
      style={frame.style}
    >
      {text}
      <Icon name="down" tone="muted" size="small" />
    </Pressable>
  );
}
