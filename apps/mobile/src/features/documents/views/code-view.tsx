import { RenderSurface } from '../../../components/ui/render-surface';
import type { RenderToken } from '../../../shared/rules/render-model';
import type { ReviewRange } from '../../../components/ui/code-range';
import { useHighlightedCode } from '../queries/highlighted-code';
import { View } from 'react-native';
import { Text } from '../../../components/ui/text';

export function CodeView({
  source,
  language,
  tokens,
  wrap = true,
  lineNumbers = true,
  selection,
  onSelect,
  initialLine,
  onReadingLine,
}: {
  source: string;
  initialLine?: number | undefined;
  onReadingLine?: ((line: number) => void) | undefined;
  language?: string | undefined;
  tokens?: readonly (readonly RenderToken[])[] | undefined;
  wrap?: boolean;
  lineNumbers?: boolean;
  selection?: ReviewRange | undefined;
  onSelect?: ((range: ReviewRange) => void) | undefined;
}) {
  const result = useHighlightedCode(source, tokens ? undefined : language);
  const highlighted = tokens ?? result?.tokens;
  const lines = source
    .replaceAll('\r\n', '\n')
    .split('\n')
    .map((text, index) => {
      const lineTokens = highlighted?.[index];
      return {
        id: String(index + 1),
        text,
        newLine: index + 1,
        ...(lineTokens ? { tokens: lineTokens } : {}),
      };
    });
  return (
    <View className="flex-1">
      {result?.error ? (
        <Text variant="caption" tone="muted">
          {result.error}
        </Text>
      ) : null}
      <RenderSurface
        documentKey={source}
        lines={lines}
        wrap={wrap}
        lineNumbers={lineNumbers}
        selection={selection}
        onSelect={onSelect}
        initialLine={initialLine}
        onReadingLine={onReadingLine}
      />
    </View>
  );
}
