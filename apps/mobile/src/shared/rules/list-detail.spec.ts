import { expect, it } from 'vitest';
import {
  closedListDrawer,
  listActionEffect,
  listDrawer,
  listDetailMode,
  layoutMove,
  listDetailModeChange,
  movesWithLayout,
  worktreeList,
  type ListAction,
  type ListDrawer,
  type ListDrawerEvent,
} from './list-detail';

it.each([
  {
    tablet: false,
    width: 932,
    mode: 'stack',
    why: 'a phone in landscape keeps pushing',
  },
  {
    tablet: false,
    width: undefined,
    mode: 'stack',
    why: 'a phone before layout',
  },
  {
    tablet: true,
    width: undefined,
    mode: 'beside',
    why: 'a tablet before layout, so nothing flashes',
  },
  { tablet: true, width: 744, mode: 'beside', why: 'iPad mini in portrait' },
  {
    tablet: true,
    width: 860,
    mode: 'beside',
    why: 'iPad landscape beside the open sidebar',
  },
  { tablet: true, width: 700, mode: 'beside', why: 'exactly the minimum' },
  { tablet: true, width: 699, mode: 'stack', why: 'just below the minimum' },
  {
    tablet: true,
    width: 320,
    mode: 'stack',
    why: 'a narrow multitasking window',
  },
] as const)('$why: $mode', ({ tablet, width, mode }) => {
  expect(listDetailMode({ tablet, width })).toBe(mode);
});

it.each([
  {
    tablet: true,
    from: undefined,
    to: 600,
    change: undefined,
    why: 'the first measurement of a narrow tablet is not a rotation',
  },
  {
    tablet: true,
    from: 1280,
    to: 640,
    change: 'stack',
    why: 'a tablet turning narrower than the minimum',
  },
  {
    tablet: true,
    from: 640,
    to: 1024,
    change: 'beside',
    why: 'a tablet turning wide enough',
  },
  {
    tablet: true,
    from: 1280,
    to: 800,
    change: undefined,
    why: 'a tablet that stays wide enough',
  },
  {
    tablet: false,
    from: 400,
    to: 900,
    change: undefined,
    why: 'a phone turning to landscape keeps pushing',
  },
] as const)('$why: $change', ({ tablet, from, to, change }) => {
  expect(listDetailModeChange({ tablet, from, to })).toBe(change);
});

it.each([
  {
    routes: ['worktrees'],
    index: 0,
    own: 0,
    moves: true,
    why: 'the tab root on top pushes its worktree when it narrows',
  },
  {
    routes: ['worktrees', 'timeline'],
    index: 1,
    own: 0,
    moves: false,
    why: 'a tab root under a pushed screen pushes nothing over it',
  },
  {
    routes: ['worktrees', 'worktree'],
    index: 1,
    own: 1,
    moves: true,
    why: 'the worktree page on top returns to the split',
  },
  {
    routes: ['worktrees', 'worktree', 'history/commit/[oid]/index'],
    index: 2,
    own: 1,
    moves: false,
    why: 'a worktree page under a commit leaves the commit open',
  },
  {
    routes: ['worktrees', 'worktree', 'file'],
    index: 2,
    own: 2,
    moves: true,
    why: 'a file above its worktree page returns to the split',
  },
  {
    routes: ['worktrees', 'worktree', 'file', 'timeline'],
    index: 3,
    own: 2,
    moves: false,
    why: 'a file under its timeline leaves the timeline open',
  },
  {
    routes: ['index', 'file'],
    index: 1,
    own: 1,
    moves: true,
    why: 'a file link above the Reviews root moves to the split',
  },
  {
    routes: ['index', 'decision', 'file'],
    index: 2,
    own: 2,
    moves: false,
    why: 'a file opened from a review step stays pushed',
  },
] as const)('$why', ({ routes, index, own, moves }) => {
  expect(movesWithLayout({ routes, index, own })).toBe(moves);
});

const collapsedRoot = {
  place: 'root',
  mode: 'stack',
  focused: true,
  onTop: true,
  collapsing: true,
  file: 'src/lib/long-reader.ts',
} as const;

it('a narrowed root in front pushes its worktree with the open file', () => {
  expect(layoutMove(collapsedRoot)).toEqual({
    kind: 'push',
    file: 'src/lib/long-reader.ts',
  });
});

it('a Worktrees root in a background tab does not navigate', () => {
  expect(layoutMove({ ...collapsedRoot, focused: false })).toEqual({
    kind: 'none',
  });
});

it('a Worktrees root under the Settings sheet does not navigate', () => {
  expect(layoutMove({ ...collapsedRoot, focused: false })).toEqual({
    kind: 'none',
  });
});

it('a collapse skipped under a pushed screen is applied on return, keeping the file', () => {
  const underTimeline = layoutMove({ ...collapsedRoot, onTop: false });
  const afterBack = layoutMove(collapsedRoot);
  expect([underTimeline, afterBack]).toEqual([
    { kind: 'none' },
    { kind: 'push', file: 'src/lib/long-reader.ts' },
  ]);
});

it('a narrow root with nothing collapsing stays on its list after Back', () => {
  expect(layoutMove({ ...collapsedRoot, collapsing: false })).toEqual({
    kind: 'none',
  });
});

it.each([
  { mode: 'beside', focused: true, onTop: true, kind: 'return' },
  { mode: 'beside', focused: false, onTop: true, kind: 'none' },
  { mode: 'beside', focused: true, onTop: false, kind: 'none' },
  { mode: 'stack', focused: true, onTop: true, kind: 'none' },
  { mode: undefined, focused: true, onTop: true, kind: 'none' },
] as const)(
  'a pushed screen measured $mode, focused $focused, on top $onTop: $kind',
  ({ mode, focused, onTop, kind }) => {
    expect(
      layoutMove({
        place: 'pushed',
        mode,
        focused,
        onTop,
        collapsing: false,
        file: undefined,
      }).kind,
    ).toBe(kind);
  },
);

const tablet = {
  layout: 'beside',
  selected: true,
  portrait: true,
  hiddenInLandscape: false,
  events: [],
  query: '',
} as const;

it.each([
  {
    situation: { ...tablet, layout: 'stack', query: 'mai' },
    place: 'beside',
    closing: 'none',
    toggle: undefined,
    why: 'a phone keeps its search when a result opens a worktree',
  },
  {
    situation: {
      ...tablet,
      layout: 'stack',
      portrait: false,
      events: ['searchFocus'],
    },
    place: 'beside',
    closing: 'none',
    toggle: undefined,
    why: 'a narrow tablet stacks like a phone and never ends a search',
  },
  {
    situation: { ...tablet, portrait: false },
    place: 'beside',
    closing: 'none',
    toggle: { label: 'hide', press: 'hide' },
    why: 'landscape keeps the list beside the content',
  },
  {
    situation: { ...tablet, portrait: false, hiddenInLandscape: true },
    place: 'away',
    closing: 'none',
    toggle: { label: 'show', press: 'unhide' },
    why: 'landscape honours the saved hide preference',
  },
  {
    situation: {
      ...tablet,
      portrait: false,
      hiddenInLandscape: true,
      query: 'mai',
    },
    place: 'beside',
    closing: 'none',
    toggle: { label: 'hide', press: 'close' },
    why: 'a live query keeps the list in landscape even when it is hidden there',
  },
  {
    situation: {
      ...tablet,
      portrait: false,
      hiddenInLandscape: true,
      events: ['searchFocus'],
    },
    place: 'beside',
    closing: 'none',
    toggle: { label: 'hide', press: 'close' },
    why: 'a focused search keeps the list in landscape even when it is hidden there',
  },
  {
    situation: tablet,
    place: 'away',
    closing: 'close',
    toggle: { label: 'show', press: 'open' },
    why: 'portrait gives the content the full width',
  },
  {
    situation: { ...tablet, events: ['show'] },
    place: 'over',
    closing: 'close',
    toggle: { label: 'hide', press: 'close' },
    why: 'Show worktrees slides the list over the content and any close ends its search',
  },
  {
    situation: { ...tablet, events: ['show', 'close'] },
    place: 'away',
    closing: 'close',
    toggle: { label: 'show', press: 'open' },
    why: 'closing the list slides it away',
  },
  {
    situation: { ...tablet, events: ['show', 'rotate'] },
    place: 'away',
    closing: 'close',
    toggle: { label: 'show', press: 'open' },
    why: 'a list opened only to browse closes on rotation to portrait',
  },
  {
    situation: { ...tablet, events: ['searchFocus', 'rotate'] },
    place: 'over',
    closing: 'close',
    toggle: { label: 'hide', press: 'close' },
    why: 'rotating to portrait while typing keeps the list over the content',
  },
  {
    situation: {
      ...tablet,
      events: ['searchFocus', 'searchBlur', 'rotate'],
      query: 'mai',
    },
    place: 'over',
    closing: 'close',
    toggle: { label: 'hide', press: 'close' },
    why: 'a query left after the keyboard went away keeps the list through rotation',
  },
  {
    situation: { ...tablet, events: ['searchFocus', 'searchBlur', 'rotate'] },
    place: 'away',
    closing: 'close',
    toggle: { label: 'show', press: 'open' },
    why: 'a search left empty no longer holds the list',
  },
  {
    situation: { ...tablet, hiddenInLandscape: true, events: ['searchFocus'] },
    place: 'over',
    closing: 'close',
    toggle: { label: 'hide', press: 'close' },
    why: 'the landscape preference does not hide a portrait search',
  },
  {
    situation: { ...tablet, selected: false, query: 'mai' },
    place: 'beside',
    closing: 'close',
    toggle: undefined,
    why: 'with nothing selected in portrait the list stays beside, and choosing a row ends its search',
  },
  {
    situation: { ...tablet, selected: false, portrait: false, query: 'mai' },
    place: 'beside',
    closing: 'none',
    toggle: undefined,
    why: 'with nothing selected in landscape choosing a row keeps the search',
  },
] as const satisfies readonly {
  situation: {
    layout: 'beside' | 'stack';
    selected: boolean;
    portrait: boolean;
    hiddenInLandscape: boolean;
    events: readonly ListDrawerEvent[];
    query: string;
  };
  place: string;
  closing: string;
  toggle: { label: string; press: string } | undefined;
  why: string;
}[])(
  '$why',
  ({ situation: { events, ...situation }, place, closing, toggle }) => {
    expect(
      worktreeList({
        ...situation,
        drawer: events.reduce(listDrawer, closedListDrawer),
      }),
    ).toEqual({ place, closing, toggle });
  },
);

type Situation = Parameters<typeof worktreeList>[0];

const pressed = (situation: Situation, action: ListAction): Situation => {
  const effect = listActionEffect(action);
  return {
    ...situation,
    drawer: effect.drawer
      ? listDrawer(situation.drawer, effect.drawer)
      : situation.drawer,
    query: effect.endSearch ? '' : situation.query,
    hiddenInLandscape: effect.hiddenInLandscape ?? situation.hiddenInLandscape,
  };
};

const drawerAfter = (events: readonly ListDrawerEvent[]): ListDrawer =>
  events.reduce(listDrawer, closedListDrawer);

const shownTablet = { layout: 'beside', selected: true } as const;

it.each([
  {
    situation: {
      portrait: false,
      hiddenInLandscape: false,
      events: [],
      query: 'mai',
    },
    via: 'Hide worktrees',
    why: 'Hide worktrees in landscape ends a typed search and hides the list in one press',
  },
  {
    situation: {
      portrait: false,
      hiddenInLandscape: false,
      events: ['searchFocus'],
      query: '',
    },
    via: 'Hide worktrees',
    why: 'Hide worktrees in landscape ends a focused search and hides the list in one press',
  },
  {
    situation: {
      portrait: false,
      hiddenInLandscape: false,
      events: [],
      query: '',
    },
    via: 'Hide worktrees',
    why: 'Hide worktrees in landscape hides a browsed list',
  },
  {
    situation: {
      portrait: false,
      hiddenInLandscape: true,
      events: [],
      query: 'mai',
    },
    via: 'Hide worktrees',
    why: 'Hide worktrees on a list a search kept in landscape ends the search and hides it',
  },
  {
    situation: {
      portrait: true,
      hiddenInLandscape: false,
      events: ['show'],
      query: '',
    },
    via: 'Hide worktrees',
    why: 'Hide worktrees in portrait slides a browsed list away',
  },
  {
    situation: {
      portrait: true,
      hiddenInLandscape: false,
      events: ['searchFocus', 'searchBlur'],
      query: 'mai',
    },
    via: 'Hide worktrees',
    why: 'Hide worktrees in portrait ends a typed search and slides the list away',
  },
  {
    situation: {
      portrait: true,
      hiddenInLandscape: true,
      events: ['show', 'searchFocus'],
      query: 'mai',
    },
    via: 'a row, a destination, the dimmed page or Back',
    why: 'any other close in portrait ends the search and slides the list away',
  },
  {
    situation: {
      portrait: true,
      hiddenInLandscape: false,
      events: ['searchFocus'],
      query: '',
    },
    via: 'a row, a destination, the dimmed page or Back',
    why: 'any other close in portrait ends a focused search',
  },
] as const satisfies readonly {
  situation: {
    portrait: boolean;
    hiddenInLandscape: boolean;
    events: readonly ListDrawerEvent[];
    query: string;
  };
  via: 'Hide worktrees' | 'a row, a destination, the dimmed page or Back';
  why: string;
}[])('$why', ({ situation: { events, ...rest }, via }) => {
  const before: Situation = {
    ...shownTablet,
    ...rest,
    drawer: drawerAfter(events),
  };
  const view = worktreeList(before);
  expect(view.place).not.toBe('away');
  const action =
    via === 'Hide worktrees'
      ? view.toggle?.label === 'hide'
        ? view.toggle.press
        : undefined
      : view.closing === 'close'
        ? 'close'
        : undefined;
  expect(action).toBeDefined();
  const after = pressed(before, action ?? 'open');
  expect(worktreeList(after).place).toBe('away');
  expect(after.query).toBe('');
  expect(after.drawer.focused).toBe(false);
});

it('Show worktrees after hiding in landscape brings the list back unfiltered', () => {
  const searching: Situation = {
    ...shownTablet,
    portrait: false,
    hiddenInLandscape: false,
    drawer: drawerAfter(['searchFocus']),
    query: 'mai',
  };
  const hidden = pressed(
    searching,
    worktreeList(searching).toggle?.press ?? 'open',
  );
  const shown = pressed(hidden, worktreeList(hidden).toggle?.press ?? 'close');
  expect(worktreeList(shown).place).toBe('beside');
  expect(shown.query).toBe('');
});
