import { RenderSurface } from './render-surface';
import type { RenderToken } from './render-model';
import type { ReviewRange } from './review-annotation';
import { useHighlightedCode } from './use-highlighted-code';
import { View } from 'react-native';
import { Text } from './text';

export function CodeView({
  source,
  language,
  tokens,
  wrap = true,
  lineNumbers = true,
  onSelect,
}: {
  source: string;
  language?: string;
  tokens?: readonly (readonly RenderToken[])[] | undefined;
  wrap?: boolean;
  lineNumbers?: boolean;
  onSelect?: ((range: ReviewRange) => void) | undefined;
}) {
  const lines = source.replaceAll('\r\n', '\n').split('\n');
  const result = useHighlightedCode(source, tokens ? undefined : language);
  const highlighted = tokens ?? result?.tokens;
  return (
    <View className="flex-1">
      {result?.error ? (
        <Text variant="caption" tone="muted">
          {result.error}
        </Text>
      ) : null}
      <RenderSurface
        key={source}
        lines={lines.map((text, index) => ({
          id: String(index + 1),
          text,
          newLine: index + 1,
          ...(highlighted?.[index] ? { tokens: highlighted[index] } : {}),
        }))}
        wrap={wrap}
        lineNumbers={lineNumbers}
        onSelect={onSelect}
      />
    </View>
  );
}
