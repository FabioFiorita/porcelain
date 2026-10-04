import { Host } from '@expo/ui';
import { ScrollView, Text } from '@expo/ui/swift-ui';
import {
  fixedSize,
  font,
  foregroundStyle,
  padding,
  textSelection,
} from '@expo/ui/swift-ui/modifiers';
import { useResolveClassNames } from 'uniwind';

export function CodeView({ text }: { text: string }) {
  const style = useResolveClassNames('text-sm text-foreground');
  return (
    <Host style={{ flex: 1 }}>
      <ScrollView axes="both">
        <Text
          markdownEnabled={false}
          modifiers={[
            font({
              design: 'monospaced',
              textStyle: 'body',
              ...(style.fontSize === undefined ? {} : { size: style.fontSize }),
            }),
            ...(typeof style.color === 'string'
              ? [foregroundStyle(style.color)]
              : []),
            fixedSize({ horizontal: true, vertical: true }),
            textSelection(true),
            padding({ all: 16 }),
          ]}
        >
          {text}
        </Text>
      </ScrollView>
    </Host>
  );
}
