import { useState } from 'react';
import { requireNativeView } from 'expo';
import { View, type NativeSyntheticEvent } from 'react-native';
import { Button } from './button';
import { CodeView } from './code-view';

const NativeMarkdown = requireNativeView<{
  source: string;
  onLink: (event: NativeSyntheticEvent<{ url: string }>) => void;
  style: { flex: number };
}>('PorcelainRenderer', 'MarkdownSurface');
export function MarkdownView({
  source,
  onLink,
}: {
  source: string;
  onLink?: (url: string) => void;
}) {
  const [raw, setRaw] = useState(false);
  return (
    <View className="flex-1 bg-background">
      <View className="flex-row justify-end border-b border-border p-2">
        <Button
          label={raw ? 'Show rendered' : 'Show source'}
          size="sm"
          variant="ghost"
          onPress={() => setRaw(!raw)}
        />
      </View>
      {raw ? (
        <CodeView source={source} language="markdown" />
      ) : (
        <NativeMarkdown
          source={source}
          onLink={(event) => onLink?.(event.nativeEvent.url)}
          style={{ flex: 1 }}
        />
      )}
    </View>
  );
}
