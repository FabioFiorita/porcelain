import { expect, it } from 'vitest';
import { phoneTopBar } from './worktree-switcher';

const create = { label: 'Create file or folder' };
const fetch = { label: 'Fetch' };
const pull = { label: 'Pull' };

it.each([
  ['Walkthrough with no page actions', 'walkthrough', []],
  ['Changes with no page actions', 'changes', []],
  ['Files with Create', 'files', [create]],
  ['History with Fetch and Pull', 'history', [fetch, pull]],
] as const)(
  'shows at most two buttons on %s: the current destination, then a menu of the rest',
  (_, section, actions) => {
    expect(phoneTopBar(section, actions)).toEqual([
      { kind: 'current', section },
      {
        kind: 'menu',
        destinations: ['walkthrough', 'changes', 'files', 'history'].filter(
          (id) => id !== section,
        ),
        actions,
      },
    ]);
  },
);

it('keeps page actions inside the menu however many there are', () => {
  const buttons = phoneTopBar('history', [create, fetch, pull]);
  expect(buttons).toHaveLength(2);
  expect(buttons[1]).toEqual({
    kind: 'menu',
    destinations: ['walkthrough', 'changes', 'files'],
    actions: [create, fetch, pull],
  });
});

it('shows only the menu with all four destinations before one is known', () => {
  expect(phoneTopBar(undefined, [])).toEqual([
    {
      kind: 'menu',
      destinations: ['walkthrough', 'changes', 'files', 'history'],
      actions: [],
    },
  ]);
});
