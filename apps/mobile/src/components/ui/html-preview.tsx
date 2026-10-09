import { isPreviewLink } from '../../shared/rules/preview-link';
import { useState } from 'react';
import { requireNativeView } from 'expo';
import { View, type NativeSyntheticEvent } from 'react-native';
import { Button } from './button';
import { CodeView } from './code-view';
import { ErrorState } from './error-state';

const NativeHtml = requireNativeView<{
  html: string;
  onLink: (event: NativeSyntheticEvent<{ url: string }>) => void;
  onError: (event: NativeSyntheticEvent<{ message: string }>) => void;
  style: { flex: number };
}>('PorcelainRenderer', 'HtmlSurface');
export function HtmlPreview({
  html,
  onLink,
}: {
  html: string;
  onLink?: (url: string) => void;
}) {
  return <HtmlContent key={html} html={html} onLink={onLink} />;
}
function HtmlContent({
  html,
  onLink,
}: {
  html: string;
  onLink?: ((url: string) => void) | undefined;
}) {
  const [source, setSource] = useState(false);
  const [error, setError] = useState('');
  return (
    <View className="flex-1 bg-background">
      <View className="flex-row justify-end border-b border-border p-2">
        <Button
          label={source ? 'Show preview' : 'Show source'}
          variant="ghost"
          size="sm"
          onPress={() => setSource(!source)}
        />
      </View>
      {source ? (
        <CodeView source={html} language="html" />
      ) : error ? (
        <ErrorState message={error} />
      ) : (
        <NativeHtml
          html={html}
          onLink={(event) => {
            if (isPreviewLink(event.nativeEvent.url))
              onLink?.(event.nativeEvent.url);
          }}
          onError={(event) => setError(event.nativeEvent.message)}
          style={{ flex: 1 }}
        />
      )}
    </View>
  );
}
