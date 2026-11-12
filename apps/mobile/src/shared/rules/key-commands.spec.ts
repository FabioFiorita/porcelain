import { expect, it } from 'vitest';
import {
  activeKeyCommands,
  keyBindings,
  keyCombo,
  keyLabel,
  keyShortcutSections,
  nativeKeyCommand,
  pressKeyCommand,
  type KeyCommand,
} from './key-commands';

const bindings = Object.values(keyBindings);

it('gives every shortcut in the app its own key combination', () => {
  const combos = bindings.map(keyCombo);
  expect(new Set(combos).size).toBe(combos.length);
});

function pressLog() {
  const pressed: string[] = [];
  return {
    pressed,
    command: (binding: KeyCommand['binding'], name: string): KeyCommand => ({
      binding,
      run: () => pressed.push(name),
    }),
  };
}

it('drops both owners of a doubled shortcut instead of letting one win', () => {
  const log = pressLog();
  const registrations = new Map([
    ['file', [log.command('timeline', 'file timeline')]],
    ['diff', [log.command('timeline', 'diff timeline')]],
    ['shell', [log.command('settings', 'settings')]],
  ]);
  const { commands, conflicts } = activeKeyCommands(registrations);
  expect(conflicts).toEqual([
    { combo: 'shift+command+t', owners: ['file', 'diff'] },
  ]);
  expect(commands.map((command) => command.binding)).toEqual(['settings']);
  pressKeyCommand(registrations, 'timeline');
  expect(log.pressed).toEqual([]);
});

it('runs the handler of the pressed live shortcut only', () => {
  const log = pressLog();
  const registrations = new Map([
    ['shell', [log.command('back', 'back')]],
    ['list', [log.command('next', 'next row')]],
  ]);
  pressKeyCommand(registrations, 'next');
  pressKeyCommand(registrations, 'timeline');
  expect(log.pressed).toEqual(['next row']);
});

it('keeps a plain key in a text field when its command asks to', () => {
  expect(
    nativeKeyCommand({
      binding: 'backEscape',
      title: 'End Search',
      whileTyping: true,
      run: () => undefined,
    }),
  ).toEqual({
    id: 'backEscape',
    title: 'End Search',
    group: 'Go',
    input: 'escape',
    modifiers: [],
    whileTyping: true,
  });
});

it('tells the native menu which shortcuts still fire inside a text field', () => {
  expect(nativeKeyCommand({ binding: 'search', run: () => undefined })).toEqual(
    {
      id: 'search',
      title: 'Search',
      group: 'List',
      input: 'f',
      modifiers: ['command'],
      whileTyping: true,
    },
  );
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
  ['open', '↩\uFE0E'],
] as const)('labels %s as %s', (binding, label) => {
  expect(keyLabel(keyBindings[binding])).toBe(label);
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
  ).toHaveLength(bindings.length);
  expect(sections[0]?.shortcuts[0]).toEqual({
    title: 'Back',
    keys: ['⌘[', 'Esc'],
  });
});
