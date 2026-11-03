export type ListDetailMode = 'beside' | 'stack';

const BESIDE_MINIMUM_WIDTH = 700;

export function listDetailMode({
  tablet,
  width,
}: {
  tablet: boolean;
  width: number | undefined;
}): ListDetailMode {
  if (!tablet) return 'stack';
  if (width === undefined) return 'beside';
  return width >= BESIDE_MINIMUM_WIDTH ? 'beside' : 'stack';
}
