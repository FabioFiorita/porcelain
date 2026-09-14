import { expect, it } from 'vitest';
import { SHORTCUT_GROUPS, SHORTCUTS } from './shortcuts';

it('documents every shortcut without assigning duplicate key combinations', () => {
  const keys = Object.values(SHORTCUTS);
  expect(new Set(keys.map((key) => key.toLowerCase())).size).toBe(keys.length);
  const documented = SHORTCUT_GROUPS.flatMap((group) =>
    group.items.map((item) => item.keys),
  );
  expect([...documented].sort()).toEqual([...keys].sort());
});
