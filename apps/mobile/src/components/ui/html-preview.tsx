import type { ReviewRange } from './review-annotation';
import { externalLink } from '@porcelain/client/links/rules';
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
  selection,
  onSelect,
}: {
  html: string;
  onLink?: (url: string) => void;
  initialMode?: 'preview' | 'source';
  wrap?: boolean;
  selection?: ReviewRange | undefined;
  onSelect?: ((range: ReviewRange) => void) | undefined;
}) {
  return (
    <HtmlContent
      key={html}
      html={html}
      onLink={onLink}
      initialMode={initialMode}
      wrap={wrap}
      selection={selection}
      onSelect={onSelect}
    />
  );
}
function HtmlContent({
  html,
  onLink,
  initialMode,
  wrap,
  selection,
  onSelect,
}: {
  html: string;
  onLink?: ((url: string) => void) | undefined;
  initialMode: 'preview' | 'source';
  wrap: boolean;
  selection?: ReviewRange | undefined;
  onSelect?: ((range: ReviewRange) => void) | undefined;
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
        <CodeView
          source={html}
          language="html"
          wrap={wrap}
          selection={selection}
          onSelect={onSelect}
        />
      ) : error ? (
        <ErrorState message={error} />
      ) : (
        <NativeHtml
          html={html}
          textScale={fontScale}
          onLink={(event) => {
            if (externalLink(event.nativeEvent.url))
              onLink?.(event.nativeEvent.url);
          }}
          onError={(event) => setError(event.nativeEvent.message)}
          style={{ flex: 1 }}
        />
      )}
    </View>
  );
}
