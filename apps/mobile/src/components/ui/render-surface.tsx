import { useRenderTokens } from './use-render-tokens';
import { requireNativeView } from 'expo';
import { type NativeSyntheticEvent } from 'react-native';
import type { ReviewRange } from './review-annotation';

import type { RenderLine } from '../../shared/rules/render-model';
type SurfaceProps = {
  data: string;
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
  wrap = true,
  lineNumbers = true,
  selection,
  onSelect,
  onExpand,
}: {
  lines: readonly RenderLine[];
  wrap?: boolean;
  lineNumbers?: boolean;
  selection?: ReviewRange | undefined;
  onSelect?: ((range: ReviewRange) => void) | undefined;
  onExpand?: ((id: string) => void) | undefined;
}) {
  const data = JSON.stringify(lines);
  const tokens = useRenderTokens();
  return (
    <NativeSurface
      data={data}
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
