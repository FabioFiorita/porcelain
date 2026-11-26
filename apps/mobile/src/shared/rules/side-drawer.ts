export type DrawerMode = 'pinned' | 'rail' | 'overlay';

const PINNED_MINIMUM_WIDTH = 1000;
const DRAWER_WIDTH = 320;
const DRAWER_SHARE = 0.85;
const EDGE_RESERVED = 24;
const SWIPE_START = 12;
const OPEN_SHARE = 1 / 3;
const FLING = 0.5;

export function drawerMode({
  tablet,
  width,
  nativeSidebar,
}: {
  tablet: boolean;
  width: number;
  nativeSidebar: boolean;
}): DrawerMode {
  if (!tablet || nativeSidebar) return 'overlay';
  return width >= PINNED_MINIMUM_WIDTH ? 'pinned' : 'rail';
}

export function drawerWidth(width: number) {
  return Math.min(DRAWER_WIDTH, Math.round(width * DRAWER_SHARE));
}

export function startsDrawerSwipe({
  open,
  enabled,
  startX,
  dx,
  dy,
  reservedEdge,
}: {
  open: boolean;
  enabled: boolean;
  startX: number;
  dx: number;
  dy: number;
  reservedEdge: boolean;
}) {
  if (!enabled) return false;
  if (Math.abs(dx) < SWIPE_START || Math.abs(dx) < 2 * Math.abs(dy))
    return false;
  if (open) return dx < 0;
  if (reservedEdge && startX < EDGE_RESERVED) return false;
  return dx > 0;
}

export function settlesOpen({
  open,
  dx,
  vx,
  width,
}: {
  open: boolean;
  dx: number;
  vx: number;
  width: number;
}) {
  if (open) return !(dx < -width * OPEN_SHARE || vx < -FLING);
  return dx > width * OPEN_SHARE || vx > FLING;
}
