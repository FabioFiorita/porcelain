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

export type ListPlace = 'beside' | 'over' | 'away';

export type ListDrawer = { open: boolean; focused: boolean };

export type ListDrawerEvent =
  | 'show'
  | 'close'
  | 'searchFocus'
  | 'searchBlur'
  | 'rotate';

export const closedListDrawer: ListDrawer = { open: false, focused: false };

export function listDrawer(
  drawer: ListDrawer,
  event: ListDrawerEvent,
): ListDrawer {
  switch (event) {
    case 'show':
      return { ...drawer, open: true };
    case 'close':
      return closedListDrawer;
    case 'searchFocus':
      return { ...drawer, focused: true };
    case 'searchBlur':
      return { ...drawer, focused: false };
    case 'rotate':
      return { ...drawer, open: false };
  }
}

export type ListAction = 'open' | 'close' | 'hide' | 'unhide';

export type ListActionEffect = {
  endSearch: boolean;
  drawer: ListDrawerEvent | undefined;
  hiddenInLandscape: boolean | undefined;
};

export function listActionEffect(action: ListAction): ListActionEffect {
  switch (action) {
    case 'open':
      return { endSearch: false, drawer: 'show', hiddenInLandscape: undefined };
    case 'close':
      return { endSearch: true, drawer: 'close', hiddenInLandscape: undefined };
    case 'hide':
      return { endSearch: true, drawer: 'close', hiddenInLandscape: true };
    case 'unhide':
      return { endSearch: false, drawer: undefined, hiddenInLandscape: false };
  }
}

export type WorktreeListView = {
  place: ListPlace;
  closing: 'close' | 'none';
  toggle: { label: 'show' | 'hide'; press: ListAction } | undefined;
};

export function worktreeList({
  layout,
  selected,
  portrait,
  hiddenInLandscape,
  drawer,
  query,
}: {
  layout: ListDetailMode;
  selected: boolean;
  portrait: boolean;
  hiddenInLandscape: boolean;
  drawer: ListDrawer;
  query: string;
}): WorktreeListView {
  if (layout === 'stack')
    return { place: 'beside', closing: 'none', toggle: undefined };
  if (!selected)
    return {
      place: 'beside',
      closing: portrait ? 'close' : 'none',
      toggle: undefined,
    };
  const live = drawer.focused || query !== '';
  if (portrait)
    return drawer.open || live
      ? {
          place: 'over',
          closing: 'close',
          toggle: { label: 'hide', press: 'close' },
        }
      : {
          place: 'away',
          closing: 'close',
          toggle: { label: 'show', press: 'open' },
        };
  if (!hiddenInLandscape)
    return {
      place: 'beside',
      closing: 'none',
      toggle: { label: 'hide', press: 'hide' },
    };
  return live
    ? {
        place: 'beside',
        closing: 'none',
        toggle: { label: 'hide', press: 'close' },
      }
    : {
        place: 'away',
        closing: 'none',
        toggle: { label: 'show', press: 'unhide' },
      };
}
