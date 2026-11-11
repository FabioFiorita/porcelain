import { expect, it } from 'vitest';
import { worktreeSwitcherForm } from './worktree-switcher';

const longTitle = 'Keep retries beside their owner';
const phone = { barWidth: 412, place: 'pushed', fontScale: 1 } as const;

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
      place: 'beside',
      fontScale: 1,
      title: undefined,
      otherItems: 3,
    }),
  ).toBe('buttons');
});
