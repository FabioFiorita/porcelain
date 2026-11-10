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

export function listDetailModeChange({
  tablet,
  from,
  to,
}: {
  tablet: boolean;
  from: number | undefined;
  to: number;
}): ListDetailMode | undefined {
  if (from === undefined) return undefined;
  const next = listDetailMode({ tablet, width: to });
  return listDetailMode({ tablet, width: from }) === next ? undefined : next;
}

const layoutRoots = new Set(['index', 'worktrees', 'worktree']);

export function movesWithLayout({
  routes,
  index,
  own,
}: {
  routes: readonly string[];
  index: number;
  own: number;
}): boolean {
  if (own !== index) return false;
  return own === 0 || layoutRoots.has(routes[own - 1] ?? '');
}
