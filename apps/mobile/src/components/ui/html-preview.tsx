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
export type HtmlMode = 'preview' | 'source';

export function htmlModeToggle(mode: HtmlMode) {
  return mode === 'source'
    ? { label: 'Show preview', mode: 'preview' as const }
    : { label: 'Show source', mode: 'source' as const };
}

export function HtmlPreview({
  initialMode = 'preview',
  ...props
}: Omit<HtmlContentProps, 'mode'> & { initialMode?: HtmlMode }) {
  const [mode, setMode] = useState(initialMode);
  const toggle = htmlModeToggle(mode);
  return (
    <View className="flex-1 bg-background">
      <View className="flex-row justify-end border-b border-border p-2">
        <Button
          label={toggle.label}
          variant="plain"
          size="sm"
          onPress={() => setMode(toggle.mode)}
        />
      </View>
      <HtmlContent {...props} mode={mode} />
    </View>
  );
}

type HtmlContentProps = {
  html: string;
  mode: HtmlMode;
  onLink?: ((url: string) => void) | undefined;
  wrap?: boolean;
  selection?: ReviewRange | undefined;
  onSelect?: ((range: ReviewRange) => void) | undefined;
};

export function HtmlContent(props: HtmlContentProps) {
  return <HtmlDocument key={props.html} {...props} />;
}

function HtmlDocument({
  html,
  mode,
  onLink,
  wrap = true,
  selection,
  onSelect,
}: HtmlContentProps) {
  const [error, setError] = useState('');
  const { fontScale } = useWindowDimensions();
  return (
    <View className="flex-1 bg-background">
      {mode === 'source' ? (
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
