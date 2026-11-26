import { RenderSurface } from '../../../components/ui/render-surface';
import type { RenderLine } from '../../../shared/rules/render-model';
import type { ReviewRange } from '../../../components/ui/code-range';
import { useHighlightedCode } from '../queries/highlighted-code';
import {
  diffSources,
  highlightDiffLines,
} from '../../../shared/rules/highlight-diff';

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
  decorate,
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
  decorate?:
    | ((lines: readonly RenderLine[]) => readonly RenderLine[])
    | undefined;
}) {
  const { oldSource, newSource } = diffSources(lines);
  const oldHighlight = useHighlightedCode(oldSource, language);
  const newHighlight = useHighlightedCode(newSource, language);
  const highlighted = highlightDiffLines(
    lines,
    oldHighlight?.tokens,
    newHighlight?.tokens,
  );
  return (
    <RenderSurface
      lines={decorate ? decorate(highlighted) : highlighted}
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
