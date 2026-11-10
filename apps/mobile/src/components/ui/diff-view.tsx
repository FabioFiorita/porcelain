import { RenderSurface } from './render-surface';
import type { RenderLine } from '../../shared/rules/render-model';
import type { ReviewRange } from './review-annotation';
import { useHighlightedCode } from './use-highlighted-code';
import {
  diffSources,
  highlightDiffLines,
} from '../../shared/rules/highlight-diff';

export function DiffView({
  lines,
  language,
  wrap = true,
  fit = false,
  selection,
  onSelect,
  onExpand,
  initialLine,
  onReadingLine,
}: {
  lines: readonly RenderLine[];
  language?: string | undefined;
  wrap?: boolean;
  fit?: boolean;
  selection?: ReviewRange | undefined;
  onSelect?: ((range: ReviewRange) => void) | undefined;
  onExpand?: ((id: string) => void) | undefined;
  initialLine?: number | undefined;
  onReadingLine?: ((line: number) => void) | undefined;
}) {
  const { oldSource, newSource } = diffSources(lines);
  const oldHighlight = useHighlightedCode(oldSource, language);
  const newHighlight = useHighlightedCode(newSource, language);
  return (
    <RenderSurface
      lines={
        oldHighlight && newHighlight
          ? highlightDiffLines(lines, oldHighlight.tokens, newHighlight.tokens)
          : undefined
      }
      wrap={wrap}
      fit={fit}
      selection={selection}
      onSelect={onSelect}
      onExpand={onExpand}
      initialLine={initialLine}
      onReadingLine={onReadingLine}
    />
  );
}
