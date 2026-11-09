import type { ReviewRange } from './review-annotation';
import { parseMarkdown } from '../../shared/rules/markdown';
import { externalLink } from '@porcelain/client/links/rules';
import { useRenderTokens } from './use-render-tokens';
import { useState } from 'react';
import { requireNativeView } from 'expo';
import { View, type NativeSyntheticEvent } from 'react-native';
import { Button } from './button';
import { CodeView } from './code-view';

const NativeMarkdown = requireNativeView<{
  data: string;
  tokens: string;
  onLink: (event: NativeSyntheticEvent<{ url: string }>) => void;
  style: { flex: number };
}>('PorcelainRenderer', 'MarkdownSurface');
export type MarkdownMode = 'reader' | 'source';

export function markdownModeToggle(mode: MarkdownMode) {
  return mode === 'source'
    ? { label: 'Show rendered', mode: 'reader' as const }
    : { label: 'Show source', mode: 'source' as const };
}

export function MarkdownView({
  initialMode = 'reader',
  ...props
}: Omit<MarkdownContentProps, 'mode'> & { initialMode?: MarkdownMode }) {
  const [mode, setMode] = useState(initialMode);
  const toggle = markdownModeToggle(mode);
  return (
    <View className="flex-1 bg-background">
      <View className="flex-row justify-end border-b border-border p-2">
        <Button
          label={toggle.label}
          size="sm"
          variant="plain"
          onPress={() => setMode(toggle.mode)}
        />
      </View>
      <MarkdownContent {...props} mode={mode} />
    </View>
  );
}

type MarkdownContentProps = {
  source: string;
  mode: MarkdownMode;
  onLink?: ((url: string) => void) | undefined;
  wrap?: boolean;
  selection?: ReviewRange | undefined;
  onSelect?: ((range: ReviewRange) => void) | undefined;
};

export function MarkdownContent({
  source,
  mode,
  onLink,
  wrap = true,
  selection,
  onSelect,
}: MarkdownContentProps) {
  const data = JSON.stringify(parseMarkdown(source));
  const tokens = useRenderTokens();
  return (
    <View className="flex-1 bg-background">
      {mode === 'source' ? (
        <CodeView
          source={source}
          language="markdown"
          wrap={wrap}
          selection={selection}
          onSelect={onSelect}
        />
      ) : (
        <NativeMarkdown
          data={data}
          tokens={JSON.stringify(tokens)}
          onLink={(event) => {
            if (externalLink(event.nativeEvent.url))
              onLink?.(event.nativeEvent.url);
          }}
          style={{ flex: 1 }}
        />
      )}
    </View>
  );
}
