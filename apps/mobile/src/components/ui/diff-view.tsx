import { RenderSurface } from './render-surface';
import type { RenderLine } from '../../shared/rules/render-model';
import type { ReviewRange } from './review-annotation';
import { useHighlightedCode } from './use-highlighted-code';
import { mergeDiffTokens } from '../../shared/rules/merge-diff-tokens';

export function DiffView({
  lines,
  language,
  wrap = true,
  selection,
  onSelect,
  onExpand,
}: {
  lines: readonly RenderLine[];
  language?: string;
  wrap?: boolean;
  selection?: ReviewRange | undefined;
  onSelect?: ((range: ReviewRange) => void) | undefined;
  onExpand?: ((id: string) => void) | undefined;
}) {
  const oldLines = lines.filter((line) => line.kind !== 'added');
  const newLines = lines.filter((line) => line.kind !== 'removed');
  const oldSource = oldLines
    .map((line) => (line.kind === 'gap' ? '' : line.text))
    .join('\n');
  const newSource = newLines
    .map((line) => (line.kind === 'gap' ? '' : line.text))
    .join('\n');
  const oldTokens = useHighlightedCode(oldSource, language);
  const newTokens = useHighlightedCode(newSource, language);
  const highlighted = new Map([
    ...oldLines.map(
      (line, index) => [line.id, oldTokens?.tokens?.[index]] as const,
    ),
    ...newLines.map(
      (line, index) => [line.id, newTokens?.tokens?.[index]] as const,
    ),
  ]);
  const rendered = language
    ? lines.map((line) => {
        const tokens = highlighted.get(line.id);
        return tokens
          ? { ...line, tokens: mergeDiffTokens(tokens, line.tokens) }
          : line;
      })
    : lines;
  return (
    <RenderSurface
      lines={rendered}
      wrap={wrap}
      selection={selection}
      onSelect={onSelect}
      onExpand={onExpand}
    />
  );
}
