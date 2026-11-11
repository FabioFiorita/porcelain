import { expect, it } from 'vitest';
import { worktreeSwitcherForm } from './worktree-switcher';

const longTitle = 'Keep retries beside their owner';
const android = { leading: 72, item: 48 };
const ios = { leading: 88, item: 56 };
const phone = {
  barWidth: 412,
  bar: android,
  place: 'pushed',
  fontScale: 1,
} as const;

it('keeps the four buttons beside a short title on a phone', () => {
  expect(worktreeSwitcherForm({ ...phone, title: 'main', otherItems: 0 })).toBe(
    'buttons',
  );
});

it('collapses into one menu when a long title would be cut to a few letters', () => {
  expect(
    worktreeSwitcherForm({ ...phone, title: longTitle, otherItems: 0 }),
  ).toBe('menu');
});

it('collapses on a small phone even for a short title', () => {
  expect(
    worktreeSwitcherForm({
      ...phone,
      barWidth: 360,
      title: 'main',
      otherItems: 0,
    }),
  ).toBe('menu');
});

it('collapses for larger text where the default size fits', () => {
  const title = 'release';
  expect(worktreeSwitcherForm({ ...phone, title, otherItems: 0 })).toBe(
    'buttons',
  );
  expect(
    worktreeSwitcherForm({ ...phone, title, otherItems: 0, fontScale: 1.3 }),
  ).toBe('menu');
});

it.each([
  ['a short title', 'main'],
  ['a medium title', 'feature-branch'],
  ['a long title', longTitle],
])(
  'keeps the same form for %s when a destination adds its one action',
  (_, title) => {
    expect(worktreeSwitcherForm({ ...phone, title, otherItems: 1 })).toBe(
      worktreeSwitcherForm({ ...phone, title, otherItems: 0 }),
    );
  },
);

it('keeps the four buttons on a tablet with a file and its actions open', () => {
  expect(
    worktreeSwitcherForm({
      barWidth: 800,
      bar: android,
      place: 'beside',
      fontScale: 1,
      title: undefined,
      otherItems: 3,
    }),
  ).toBe('buttons');
});

it('uses the wider iOS bar items: a 402-point iPhone collapses where a 440-point one keeps the buttons', () => {
  const iphone = { ...phone, bar: ios, title: 'main', otherItems: 0 };
  expect(worktreeSwitcherForm({ ...iphone, barWidth: 402 })).toBe('menu');
  expect(worktreeSwitcherForm({ ...iphone, barWidth: 440 })).toBe('buttons');
});

it('keeps the four buttons on an iPad in portrait with a file open', () => {
  expect(
    worktreeSwitcherForm({
      barWidth: 834,
      bar: ios,
      place: 'beside',
      fontScale: 1,
      title: undefined,
      otherItems: 3,
    }),
  ).toBe('buttons');
});
