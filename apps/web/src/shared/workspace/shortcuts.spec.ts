import { expect, test } from 'vitest';
import { formatShortcutForAria } from './shortcuts';

test.each([
  { shortcut: 'Mod+B', platform: 'mac', expected: 'Meta+B' },
  { shortcut: 'Mod+B', platform: 'linux', expected: 'Control+B' },
  { shortcut: 'Mod+B', platform: 'windows', expected: 'Control+B' },
  { shortcut: 'Alt+Shift+R', platform: 'mac', expected: 'Alt+Shift+R' },
  { shortcut: 'Alt+Shift+R', platform: 'linux', expected: 'Alt+Shift+R' },
  { shortcut: 'Alt+Shift+R', platform: 'windows', expected: 'Alt+Shift+R' },
  { shortcut: 'J', platform: 'mac', expected: 'J' },
  { shortcut: 'J', platform: 'linux', expected: 'J' },
  { shortcut: 'Escape', platform: 'mac', expected: 'Escape' },
  { shortcut: 'Escape', platform: 'linux', expected: 'Escape' },
] as const)(
  '$shortcut on $platform has ARIA keys $expected',
  ({ shortcut, platform, expected }) => {
    expect(formatShortcutForAria(shortcut, platform)).toBe(expected);
  },
);
