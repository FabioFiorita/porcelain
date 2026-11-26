import { expect, it } from 'vite-plus/test';
import {
  drawerMode,
  drawerWidth,
  settlesOpen,
  startsDrawerSwipe,
} from './side-drawer';

it.each([
  {
    tablet: true,
    width: 1280,
    mode: 'pinned',
    why: 'a landscape tablet keeps the worktrees beside the content',
  },
  {
    tablet: true,
    width: 800,
    mode: 'overlay',
    why: 'a portrait tablet slides them over',
  },
  {
    tablet: false,
    width: 1100,
    mode: 'overlay',
    why: 'a phone in landscape still slides them over',
  },
] as const)('$why', ({ tablet, width, mode }) => {
  expect(drawerMode({ tablet, width })).toBe(mode);
});

it('the drawer is 320 wide, or 85% of a narrow screen', () => {
  expect([drawerWidth(1280), drawerWidth(360)]).toEqual([320, 306]);
});

const swipe = {
  open: false,
  enabled: true,
  startX: 120,
  dx: 40,
  dy: 5,
  reservedEdge: false,
};

it.each([
  { change: {}, starts: true, why: 'a rightward swipe on a tab root opens it' },
  {
    change: { enabled: false },
    starts: false,
    why: 'a pushed screen keeps its own Back swipe',
  },
  {
    change: { dy: 30 },
    starts: false,
    why: 'a mostly vertical drag scrolls instead',
  },
  { change: { dx: 8 }, starts: false, why: 'a small movement is a tap' },
  {
    change: { dx: -40 },
    starts: false,
    why: 'a leftward swipe does not open it',
  },
  {
    change: { reservedEdge: true, startX: 10 },
    starts: false,
    why: 'the Android Back edge stays with the system',
  },
  {
    change: { reservedEdge: true, startX: 60 },
    starts: true,
    why: 'just inside the Android edge still opens it',
  },
  {
    change: { open: true, dx: -40 },
    starts: true,
    why: 'a leftward swipe closes an open drawer',
  },
  {
    change: { open: true },
    starts: false,
    why: 'a rightward swipe on an open drawer does nothing',
  },
] as const)('$why', ({ change, starts }) => {
  expect(startsDrawerSwipe({ ...swipe, ...change })).toBe(starts);
});

it.each([
  {
    open: false,
    dx: 150,
    vx: 0,
    settles: true,
    why: 'dragged past a third it stays open',
  },
  {
    open: false,
    dx: 60,
    vx: 0,
    settles: false,
    why: 'a short drag springs back closed',
  },
  { open: false, dx: 40, vx: 1, settles: true, why: 'a quick flick opens it' },
  {
    open: true,
    dx: -150,
    vx: 0,
    settles: false,
    why: 'dragged back past a third it closes',
  },
  {
    open: true,
    dx: -40,
    vx: 0,
    settles: true,
    why: 'a short drag back stays open',
  },
] as const)('$why', ({ open, dx, vx, settles }) => {
  expect(settlesOpen({ open, dx, vx, width: 320 })).toBe(settles);
});
