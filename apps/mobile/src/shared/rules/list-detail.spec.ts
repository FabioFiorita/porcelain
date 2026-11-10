import { expect, it } from 'vitest';
import {
  listDetailMode,
  layoutMove,
  listDetailModeChange,
  movesWithLayout,
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
