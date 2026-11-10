import { expect, it, vi } from 'vitest';
import {
  activeKeyCommands,
  keyBindings,
  keyCombo,
  keyLabel,
  keyShortcutSections,
  nativeKeyCommand,
  pressKeyCommand,
  type KeyBindingName,
} from './key-commands';

const names = Object.keys(keyBindings) as KeyBindingName[];

it('gives every shortcut in the app its own key combination', () => {
  const combos = names.map(keyCombo);
  expect(new Set(combos).size).toBe(combos.length);
});

it('drops both owners of a doubled shortcut instead of letting one win', () => {
  const first = vi.fn();
  const second = vi.fn();
  const registrations = new Map([
    ['file', [{ binding: 'timeline' as const, run: first }]],
    ['diff', [{ binding: 'timeline' as const, run: second }]],
    ['shell', [{ binding: 'settings' as const, run: vi.fn() }]],
  ]);
  const { commands, conflicts } = activeKeyCommands(registrations);
  expect(conflicts).toEqual([
    { combo: 'shift+command+t', owners: ['file', 'diff'] },
  ]);
  expect(commands.map((command) => command.binding)).toEqual(['settings']);
  pressKeyCommand(registrations, 'timeline');
  expect(first).not.toHaveBeenCalled();
  expect(second).not.toHaveBeenCalled();
});

it('runs the handler of the pressed live shortcut only', () => {
  const back = vi.fn();
  const next = vi.fn();
  const registrations = new Map([
    ['shell', [{ binding: 'back' as const, run: back }]],
    ['list', [{ binding: 'next' as const, run: next }]],
  ]);
  pressKeyCommand(registrations, 'next');
  pressKeyCommand(registrations, 'timeline');
  expect(next).toHaveBeenCalledTimes(1);
  expect(back).not.toHaveBeenCalled();
});

it('tells the native menu which shortcuts still fire inside a text field', () => {
  expect(
    nativeKeyCommand({ binding: 'search', run: () => undefined }),
  ).toEqual({
    id: 'search',
    title: 'Search',
    group: 'List',
    input: 'f',
    modifiers: ['command'],
    whileTyping: true,
  });
  expect(
    nativeKeyCommand({ binding: 'next', run: () => undefined }).whileTyping,
  ).toBe(false);
  expect(
    nativeKeyCommand({
      binding: 'documentMode',
      title: 'Show rendered',
      run: () => undefined,
    }).title,
  ).toBe('Show rendered');
});

it.each([
  ['timeline', '⇧⌘T'],
  ['back', '⌘['],
  ['backEscape', 'Esc'],
  ['next', '↓'],
  ['nextJ', 'J'],
  ['open', '↩'],
] as const)('labels %s as %s', (binding, label) => {
  expect(keyLabel(binding)).toBe(label);
});

it('lists every shortcut once, grouped, with its alternative keys together', () => {
  const sections = keyShortcutSections();
  expect(sections.map((section) => section.title)).toEqual([
    'Go',
    'Worktree',
    'List',
    'Document',
  ]);
  expect(
    sections.flatMap((section) => section.shortcuts.flatMap((row) => row.keys)),
  ).toHaveLength(names.length);
  expect(sections[0]?.shortcuts[0]).toEqual({
    title: 'Back',
    keys: ['⌘[', 'Esc'],
  });
});
