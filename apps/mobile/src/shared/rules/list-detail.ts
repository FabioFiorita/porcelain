export type ListDetailMode = 'beside' | 'stack';

const BESIDE_MINIMUM_WIDTH = 700;
const LIST_WIDEST = 340;
const LIST_NARROWEST = 280;
const LIST_SHARE = 0.42;

export function listColumnWidth(width: number | undefined) {
  if (width === undefined) return LIST_WIDEST;
  return Math.round(
    Math.min(LIST_WIDEST, Math.max(LIST_NARROWEST, width * LIST_SHARE)),
  );
}

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

const layoutRoots = new Set(['walkthrough', 'changes', 'files', 'history']);

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

export type LayoutMove =
  | { readonly kind: 'none' }
  | { readonly kind: 'push'; readonly file: string | undefined }
  | { readonly kind: 'return' };

export function layoutMove({
  place,
  mode,
  focused,
  onTop,
  collapsing,
  file,
}: {
  place: 'root' | 'pushed';
  mode: ListDetailMode | undefined;
  focused: boolean;
  onTop: boolean;
  collapsing: boolean;
  file: string | undefined;
}): LayoutMove {
  if (!focused || !onTop || mode === undefined) return { kind: 'none' };
  if (place === 'pushed')
    return mode === 'beside' ? { kind: 'return' } : { kind: 'none' };
  return mode === 'stack' && collapsing
    ? { kind: 'push', file }
    : { kind: 'none' };
}
