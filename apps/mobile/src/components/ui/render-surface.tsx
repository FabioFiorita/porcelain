import { requireNativeView } from 'expo';
import { processColor, type NativeSyntheticEvent } from 'react-native';
import { useResolveClassNames } from 'uniwind';
import type { ReviewRange } from './review-annotation';

import type { RenderLine } from './render-model';
type SurfaceProps = {
  data: string;
  wrap: boolean;
  lineNumbers: boolean;
  foreground: number;
  background: number;
  muted: number;
  onSelect?: ((event: NativeSyntheticEvent<ReviewRange>) => void) | undefined;
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
  onSelect,
  onExpand,
}: {
  lines: readonly RenderLine[];
  wrap?: boolean;
  lineNumbers?: boolean;
  onSelect?: ((range: ReviewRange) => void) | undefined;
  onExpand?: ((id: string) => void) | undefined;
}) {
  const foreground = useResolveClassNames('text-foreground');
  const background = useResolveClassNames('bg-background');
  const muted = useResolveClassNames('text-muted-foreground');
  const color = (value: typeof foreground.color) => {
    const resolved = processColor(value);
    return typeof resolved === 'number' ? resolved >>> 0 : 0;
  };
  return (
    <NativeSurface
      data={JSON.stringify(lines)}
      wrap={wrap}
      lineNumbers={lineNumbers}
      foreground={color(foreground.color)}
      background={color(background.backgroundColor)}
      muted={color(muted.color)}
      onSelect={onSelect ? (event) => onSelect(event.nativeEvent) : undefined}
      onExpand={
        onExpand ? (event) => onExpand(event.nativeEvent.id) : undefined
      }
      style={{ flex: 1 }}
    />
  );
}
