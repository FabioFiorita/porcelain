import { useRenderTokens } from './use-render-tokens';
import { requireNativeView } from 'expo';
import { useState } from 'react';
import { type NativeSyntheticEvent } from 'react-native';
import type { ReviewRange } from './review-annotation';

import type { RenderLine } from '../../shared/rules/render-model';
type SurfaceProps = {
  data: string;
  initialLine?: number | undefined;
  onReadingLine?:
    | ((event: NativeSyntheticEvent<{ line: number }>) => void)
    | undefined;
  tokens: string;
  wrap: boolean;
  lineNumbers: boolean;
  foreground: number;
  background: number;
  muted: number;
  selection: string;
  selectable: boolean;
  onCodeSelect?:
    | ((event: NativeSyntheticEvent<ReviewRange>) => void)
    | undefined;
  onExpand?:
    | ((event: NativeSyntheticEvent<{ id: string }>) => void)
    | undefined;
  style: { flex: number };
};
const NativeSurface = requireNativeView<SurfaceProps>(
  'PorcelainRenderer',
  'CodeSurface',
);
export function RenderSurface({
  lines,
  documentKey,
  wrap = true,
  lineNumbers = true,
  selection,
  onSelect,
  onExpand,
  initialLine,
  onReadingLine,
}: {
  lines: readonly RenderLine[] | undefined;
  documentKey?: string | undefined;
  initialLine?: number | undefined;
  onReadingLine?: ((line: number) => void) | undefined;
  wrap?: boolean;
  lineNumbers?: boolean;
  selection?: ReviewRange | undefined;
  onSelect?: ((range: ReviewRange) => void) | undefined;
  onExpand?: ((id: string) => void) | undefined;
}) {
  const tokens = useRenderTokens();
  const next = lines ? JSON.stringify(lines) : undefined;
  const [painted, setPainted] = useState(
    next === undefined ? undefined : { data: next, documentKey },
  );
  if (next !== undefined && next !== painted?.data)
    setPainted({ data: next, documentKey });
  const data = next ?? painted?.data;
  if (data === undefined) return null;
  return (
    <NativeSurface
      key={next === undefined ? painted?.documentKey : documentKey}
      data={data}
      initialLine={initialLine}
      onReadingLine={
        onReadingLine
          ? (event) => onReadingLine(event.nativeEvent.line)
          : undefined
      }
      tokens={JSON.stringify(tokens)}
      wrap={wrap}
      lineNumbers={lineNumbers}
      foreground={tokens.foreground}
      background={tokens.background}
      muted={tokens.muted}
      selection={selection ? JSON.stringify(selection) : ''}
      selectable={onSelect !== undefined}
      onCodeSelect={
        onSelect ? (event) => onSelect(event.nativeEvent) : undefined
      }
      onExpand={
        onExpand ? (event) => onExpand(event.nativeEvent.id) : undefined
      }
      style={{ flex: 1 }}
    />
  );
}
