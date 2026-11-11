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

export type ListPresentation = 'beside' | 'over' | 'hidden';

export function listPresentation({
  overlay,
  portrait,
  hidden,
  open,
}: {
  overlay: boolean;
  portrait: boolean;
  hidden: boolean;
  open: boolean;
}): ListPresentation {
  if (overlay && portrait) return open ? 'over' : 'hidden';
  return hidden ? 'hidden' : 'beside';
}

export type ListDrawer = { open: boolean; searching: boolean };

export type ListDrawerEvent =
  | 'show'
  | 'close'
  | 'searchFocus'
  | 'searchBlur'
  | 'rotate';

export const closedListDrawer: ListDrawer = { open: false, searching: false };

export function listDrawer(
  drawer: ListDrawer,
  event: ListDrawerEvent,
): ListDrawer {
  switch (event) {
    case 'show':
      return { ...drawer, open: true };
    case 'close':
      return { ...drawer, open: false };
    case 'searchFocus':
      return { open: true, searching: true };
    case 'searchBlur':
      return { ...drawer, searching: false };
    case 'rotate':
      return { ...drawer, open: drawer.searching };
  }
}
