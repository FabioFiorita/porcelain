import { isPreviewLink } from '../../shared/rules/preview-link';
import { useState } from 'react';
import { requireNativeView } from 'expo';
import {
  View,
  useWindowDimensions,
  type NativeSyntheticEvent,
} from 'react-native';
import { Button } from './button';
import { CodeView } from './code-view';
import { ErrorState } from './error-state';

const NativeHtml = requireNativeView<{
  html: string;
  textScale: number;
  onLink: (event: NativeSyntheticEvent<{ url: string }>) => void;
  onError: (event: NativeSyntheticEvent<{ message: string }>) => void;
  style: { flex: number };
}>('PorcelainRenderer', 'HtmlSurface');
export function HtmlPreview({
  html,
  onLink,
  initialMode = 'preview',
  wrap = true,
}: {
  html: string;
  onLink?: (url: string) => void;
  initialMode?: 'preview' | 'source';
  wrap?: boolean;
}) {
  return (
    <HtmlContent
      key={html}
      html={html}
      onLink={onLink}
      initialMode={initialMode}
      wrap={wrap}
    />
  );
}
function HtmlContent({
  html,
  onLink,
  initialMode,
  wrap,
}: {
  html: string;
  onLink?: ((url: string) => void) | undefined;
  initialMode: 'preview' | 'source';
  wrap: boolean;
}) {
  const [source, setSource] = useState(initialMode === 'source');
  const [error, setError] = useState('');
  const { fontScale } = useWindowDimensions();
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
        <CodeView source={html} language="html" wrap={wrap} />
      ) : error ? (
        <ErrorState message={error} />
      ) : (
        <NativeHtml
          html={html}
          textScale={fontScale}
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
