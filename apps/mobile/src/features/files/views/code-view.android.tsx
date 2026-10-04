import { ScrollView, Text, View } from 'react-native';
import { useResolveClassNames } from 'uniwind';

export function CodeView({ text, numbers }: { text: string; numbers: string }) {
  const surface = useResolveClassNames('flex-1 bg-card');
  const row = useResolveClassNames('flex-row items-start');
  const code = useResolveClassNames(
    'p-4 font-mono text-[13px] leading-5 text-foreground',
  );
  const gutter = useResolveClassNames(
    'bg-muted px-3 py-4 text-right font-mono text-[13px] leading-5 text-muted-foreground',
  );
  return (
    <ScrollView style={surface}>
      <ScrollView horizontal>
        <View style={row}>
          <Text accessible={false} style={gutter}>
            {numbers}
          </Text>
          <Text selectable style={code}>
            {text}
          </Text>
        </View>
      </ScrollView>
    </ScrollView>
  );
}
