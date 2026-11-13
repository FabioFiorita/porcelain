import { requireNativeView } from 'expo';
import type { NativeSyntheticEvent } from 'react-native';
import { externalLink } from '@porcelain/client/links/rules';
import { parseMarkdown } from '../../shared/rules/markdown';
import { useRenderTokens } from './use-render-tokens';

const NativeMarkdown = requireNativeView<{
  data: string;
  tokens: string;
  onLink: (event: NativeSyntheticEvent<{ url: string }>) => void;
  style: { flex: number };
}>('PorcelainRenderer', 'MarkdownSurface');

export function MarkdownSurface({
  source,
  onLink,
}: {
  source: string;
  onLink?: ((url: string) => void) | undefined;
}) {
  const tokens = useRenderTokens();
  return (
    <NativeMarkdown
      data={JSON.stringify(parseMarkdown(source))}
      tokens={JSON.stringify(tokens)}
      onLink={(event) => {
        if (externalLink(event.nativeEvent.url))
          onLink?.(event.nativeEvent.url);
      }}
      style={{ flex: 1 }}
    />
  );
}
