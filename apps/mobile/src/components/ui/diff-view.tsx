import { RenderSurface } from './render-surface';
import type { RenderLine } from './render-model';
import type { ReviewRange } from './review-annotation';
import { useHighlightedCode } from './use-highlighted-code';
import { mergeDiffTokens } from './highlight-code';

export function DiffView({
  lines,
  language,
  wrap = true,
  onSelect,
  onExpand,
}: {
  lines: readonly RenderLine[];
  language?: string;
  wrap?: boolean;
  onSelect?: ((range: ReviewRange) => void) | undefined;
  onExpand?: ((id: string) => void) | undefined;
}) {
  const oldLines = lines.filter((line) => line.kind !== 'added');
  const newLines = lines.filter((line) => line.kind !== 'removed');
  const oldTokens = useHighlightedCode(
    oldLines.map((line) => (line.kind === 'gap' ? '' : line.text)).join('\n'),
    language,
  );
  const newTokens = useHighlightedCode(
    newLines.map((line) => (line.kind === 'gap' ? '' : line.text)).join('\n'),
    language,
  );
  const highlighted = new Map([
    ...oldLines.map(
      (line, index) => [line.id, oldTokens?.tokens?.[index]] as const,
    ),
    ...newLines.map(
      (line, index) => [line.id, newTokens?.tokens?.[index]] as const,
    ),
  ]);
  return (
    <RenderSurface
      lines={
        language
          ? lines.map((line) => {
              const tokens = highlighted.get(line.id);
              return !tokens
                ? line
                : { ...line, tokens: mergeDiffTokens(tokens, line.tokens) };
            })
          : lines
      }
      wrap={wrap}
      onSelect={onSelect}
      onExpand={onExpand}
    />
  );
}
