import { Host } from '@expo/ui';
import { HStack, ScrollView, Text } from '@expo/ui/swift-ui';
import {
  accessibilityHidden,
  background,
  fixedSize,
  font,
  foregroundStyle,
  lineHeight,
  padding,
  textSelection,
} from '@expo/ui/swift-ui/modifiers';
import { useResolveClassNames } from 'uniwind';

export function CodeView({ text, numbers }: { text: string; numbers: string }) {
  const surface = useResolveClassNames('flex-1 bg-card');
  const style = useResolveClassNames('text-[13px] leading-5 text-foreground');
  const gutter = useResolveClassNames('bg-muted text-muted-foreground');
  const typography = [
    font({
      design: 'monospaced',
      textStyle: 'body',
      size: style.fontSize ?? 13,
    }),
    lineHeight(style.lineHeight ?? 20),
    fixedSize({ horizontal: true, vertical: true }),
  ];
  return (
    <Host style={surface}>
      <ScrollView axes="both">
        <HStack alignment="top" spacing={0}>
          <Text
            markdownEnabled={false}
            modifiers={[
              ...typography,
              accessibilityHidden(true),
              ...(typeof gutter.color === 'string'
                ? [foregroundStyle(gutter.color)]
                : []),
              padding({ leading: 16, trailing: 12, top: 16, bottom: 16 }),
              ...(typeof gutter.backgroundColor === 'string'
                ? [background(gutter.backgroundColor)]
                : []),
            ]}
          >
            {numbers}
          </Text>
          <Text
            markdownEnabled={false}
            modifiers={[
              ...typography,
              ...(typeof style.color === 'string'
                ? [foregroundStyle(style.color)]
                : []),
              textSelection(true),
              padding({ all: 16 }),
            ]}
          >
            {text}
          </Text>
        </HStack>
      </ScrollView>
    </Host>
  );
}
