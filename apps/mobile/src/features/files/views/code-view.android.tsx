import { ScrollView, Text } from 'react-native';

export function CodeView({ text }: { text: string }) {
  return (
    <ScrollView className="flex-1">
      <ScrollView horizontal>
        <Text selectable className="p-4 font-mono text-sm text-foreground">
          {text}
        </Text>
      </ScrollView>
    </ScrollView>
  );
}
