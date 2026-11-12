import { expect, it } from 'vitest';
import {
  activeList,
  moveCursor,
  nextList,
  tabHolder,
  treeStep,
} from './list-cursor';

const rows = [{ key: 'a' }, { key: 'b' }, { key: 'c' }];

it.each([
  {
    current: undefined,
    move: 'next',
    selected: undefined,
    to: 'a',
    why: 'the first press starts at the top',
  },
  {
    current: undefined,
    move: 'previous',
    selected: undefined,
    to: 'c',
    why: 'going up first starts at the bottom',
  },
  {
    current: undefined,
    move: 'next',
    selected: 'b',
    to: 'b',
    why: 'the first press starts at the open row',
  },
  {
    current: 'a',
    move: 'next',
    selected: undefined,
    to: 'b',
    why: 'down moves one row',
  },
  {
    current: 'b',
    move: 'previous',
    selected: undefined,
    to: 'a',
    why: 'up moves one row',
  },
  {
    current: 'c',
    move: 'next',
    selected: undefined,
    to: 'c',
    why: 'the last row holds',
  },
  {
    current: 'a',
    move: 'previous',
    selected: undefined,
    to: 'a',
    why: 'the first row holds',
  },
  {
    current: 'gone',
    move: 'next',
    selected: undefined,
    to: 'a',
    why: 'a row that left the list starts over',
  },
] as const)('$why', ({ current, move, selected, to }) => {
  expect(moveCursor(rows, current, move, selected)).toBe(to);
});

it('has nothing to highlight in an empty list', () => {
  expect(moveCursor([], undefined, 'next')).toBeUndefined();
});

const tree = [
  { key: 'src', depth: 0, folder: 'open' as const },
  { key: 'src/app', depth: 1, folder: 'closed' as const },
  { key: 'src/main.ts', depth: 1 },
  { key: 'docs', depth: 0, folder: 'open' as const },
  { key: 'README.md', depth: 0 },
];

it.each([
  {
    current: 'src/app',
    direction: 'in',
    step: { kind: 'toggle', key: 'src/app' },
    why: 'right opens a closed folder',
  },
  {
    current: 'src',
    direction: 'in',
    step: { kind: 'move', key: 'src/app' },
    why: 'right on an open folder enters it',
  },
  {
    current: 'docs',
    direction: 'in',
    step: undefined,
    why: 'an open empty folder has nothing to enter',
  },
  {
    current: 'README.md',
    direction: 'in',
    step: undefined,
    why: 'right does nothing on a file',
  },
  {
    current: 'src',
    direction: 'out',
    step: { kind: 'toggle', key: 'src' },
    why: 'left closes an open folder',
  },
  {
    current: 'src/main.ts',
    direction: 'out',
    step: { kind: 'move', key: 'src' },
    why: 'left on a file goes to its folder',
  },
  {
    current: 'src/app',
    direction: 'out',
    step: { kind: 'move', key: 'src' },
    why: 'left on a closed folder goes to its parent',
  },
  {
    current: 'README.md',
    direction: 'out',
    step: undefined,
    why: 'a top-level file has no parent',
  },
  {
    current: undefined,
    direction: 'in',
    step: undefined,
    why: 'nothing happens before a row is highlighted',
  },
] as const)('$why', ({ current, direction, step }) => {
  expect(treeStep(tree, current, direction)).toEqual(step);
});

it('lets the list the developer last chose take the keys while it is on screen', () => {
  expect(activeList(['worktrees', 'files'], undefined)).toBe('files');
  expect(activeList(['worktrees', 'files'], 'worktrees')).toBe('worktrees');
  expect(activeList(['files'], 'worktrees')).toBe('files');
  expect(activeList([], undefined)).toBeUndefined();
});

it('moves to the next list on screen and wraps around', () => {
  expect(nextList(['worktrees', 'files'], 'worktrees')).toBe('files');
  expect(nextList(['worktrees', 'files'], undefined)).toBe('worktrees');
});

it.each([
  {
    lists: ['worktrees', 'files'],
    away: false,
    holder: 'lists',
    why: 'two lists on screen take Tab to move between them',
  },
  {
    lists: ['files'],
    away: true,
    holder: 'away',
    why: 'with the worktrees list slid away over Files or History, Tab stays on the page list',
  },
  {
    lists: [],
    away: true,
    holder: 'away',
    why: 'with the worktrees list slid away over Changes or the Walkthrough, Tab is still claimed so it cannot reach the hidden search',
  },
  {
    lists: ['worktrees'],
    away: false,
    holder: undefined,
    why: 'a single visible list leaves Tab to the system',
  },
  {
    lists: [],
    away: false,
    holder: undefined,
    why: 'with no list at all Tab stays with the system',
  },
] as const)('$why', ({ lists, away, holder }) => {
  expect(tabHolder(lists, away)).toBe(holder);
});
