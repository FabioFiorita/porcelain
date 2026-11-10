import type { ComponentProps } from 'react';
import { View } from 'react-native';
import { richParts } from '@porcelain/client/walkthroughs/rules';
import { Text } from './text';

type TextProps = ComponentProps<typeof Text>;

export function RichText({
  text,
  variant = 'body',
  tone = 'default',
  weight,
  lines,
  onClipped,
}: {
  text: string;
  variant?: TextProps['variant'];
  tone?: TextProps['tone'];
  weight?: TextProps['weight'];
  lines?: number | undefined;
  onClipped?: ((clipped: boolean) => void) | undefined;
}) {
  const parts = richParts(text).map((part, index) =>
    part.kind === 'code' ? (
      <Text
        key={index}
        variant={variant}
        tone={tone}
        {...(weight ? { weight } : {})}
        className="bg-muted font-mono"
      >
        {part.text}
      </Text>
    ) : (
      part.text
    ),
  );
  const shown = (
    <Text
      variant={variant}
      tone={tone}
      {...(weight ? { weight } : {})}
      {...(lines === undefined ? {} : { numberOfLines: lines })}
    >
      {parts}
    </Text>
  );
  if (lines === undefined || onClipped === undefined) return shown;
  return (
    <View collapsable={false}>
      {shown}
      <View
        className="absolute inset-x-0 top-0 opacity-0"
        pointerEvents="none"
        accessible={false}
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
      >
        <Text
          variant={variant}
          {...(weight ? { weight } : {})}
          onTextLayout={(event) =>
            onClipped(event.nativeEvent.lines.length > lines)
          }
        >
          {parts}
        </Text>
      </View>
    </View>
  );
}
