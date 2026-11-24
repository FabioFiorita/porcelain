import { View } from 'react-native';
import { headerTitleText, useHeaderTitleFrame } from './header-title-frame';
import { Text } from './text';

const headerFontScale = 1.5;

export function HeaderTitle({
  title,
  subtitle,
  trailingItems,
}: {
  title: string;
  subtitle?: string | undefined;
  trailingItems: number;
}) {
  const frame = useHeaderTitleFrame(trailingItems);
  return (
    <View className={frame.className} style={frame.style}>
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
}
