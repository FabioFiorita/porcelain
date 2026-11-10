type Letter =
  | 'a'
  | 'b'
  | 'c'
  | 'd'
  | 'e'
  | 'f'
  | 'g'
  | 'h'
  | 'i'
  | 'j'
  | 'k'
  | 'l'
  | 'm'
  | 'n'
  | 'o'
  | 'p'
  | 'q'
  | 'r'
  | 's'
  | 't'
  | 'u'
  | 'v'
  | 'w'
  | 'x'
  | 'y'
  | 'z';
type Digit = '0' | '1' | '2' | '3' | '4' | '5' | '6' | '7' | '8' | '9';
type SpecialKey =
  | 'up'
  | 'down'
  | 'left'
  | 'right'
  | 'return'
  | 'escape'
  | 'tab'
  | 'space';

type KeyInput = Letter | Digit | '[' | ']' | ',' | '/' | SpecialKey;
type KeyModifier = 'command' | 'shift' | 'option' | 'control';

const keyGroups = {
  navigate: 'Go',
  worktree: 'Worktree',
  list: 'List',
  document: 'Document',
} as const;

type KeyGroup = keyof typeof keyGroups;

const keyGroupOrder: readonly KeyGroup[] = [
  'navigate',
  'worktree',
  'list',
  'document',
];

type KeyBinding = {
  title: string;
  group: KeyGroup;
  key: KeyInput;
  modifiers: readonly KeyModifier[];
};

export const keyBindings = {
  back: { title: 'Back', group: 'navigate', key: '[', modifiers: ['command'] },
  backEscape: {
    title: 'Back',
    group: 'navigate',
    key: 'escape',
    modifiers: [],
  },
  close: {
    title: 'Close',
    group: 'navigate',
    key: 'w',
    modifiers: ['command'],
  },
  settings: {
    title: 'Settings',
    group: 'navigate',
    key: ',',
    modifiers: ['command'],
  },
  shortcuts: {
    title: 'Keyboard Shortcuts',
    group: 'navigate',
    key: '/',
    modifiers: ['command'],
  },
  walkthrough: {
    title: 'Walkthrough',
    group: 'worktree',
    key: '0',
    modifiers: ['command'],
  },
  changes: {
    title: 'Changes',
    group: 'worktree',
    key: '1',
    modifiers: ['command'],
  },
  files: {
    title: 'Files',
    group: 'worktree',
    key: '2',
    modifiers: ['command'],
  },
  history: {
    title: 'History',
    group: 'worktree',
    key: '3',
    modifiers: ['command'],
  },
  search: { title: 'Search', group: 'list', key: 'f', modifiers: ['command'] },
  next: { title: 'Next Row', group: 'list', key: 'down', modifiers: [] },
  previous: { title: 'Previous Row', group: 'list', key: 'up', modifiers: [] },
  nextJ: { title: 'Next Row', group: 'list', key: 'j', modifiers: [] },
  previousK: { title: 'Previous Row', group: 'list', key: 'k', modifiers: [] },
  open: { title: 'Open Row', group: 'list', key: 'return', modifiers: [] },
  expand: {
    title: 'Expand Folder',
    group: 'list',
    key: 'right',
    modifiers: [],
  },
  collapse: {
    title: 'Collapse Folder',
    group: 'list',
    key: 'left',
    modifiers: [],
  },
  nextList: { title: 'Next List', group: 'list', key: 'tab', modifiers: [] },
  timeline: {
    title: 'Timeline',
    group: 'document',
    key: 't',
    modifiers: ['command', 'shift'],
  },
  documentMode: {
    title: 'Show Source or Rendered',
    group: 'document',
    key: 's',
    modifiers: ['command', 'shift'],
  },
} as const satisfies Record<string, KeyBinding>;

export type KeyBindingName = keyof typeof keyBindings;

export type KeyCommand = {
  binding: KeyBindingName;
  title?: string | undefined;
  run: () => void;
};

export type NativeKeyCommand = {
  id: KeyBindingName;
  title: string;
  group: string;
  input: KeyInput;
  modifiers: readonly KeyModifier[];
  whileTyping: boolean;
};

const modifierOrder: readonly KeyModifier[] = [
  'control',
  'option',
  'shift',
  'command',
];

export function keyCombo({ key, modifiers }: KeyBinding) {
  return [
    ...modifierOrder.filter((modifier) => modifiers.includes(modifier)),
    key,
  ].join('+');
}

type KeyCommandConflict = {
  combo: string;
  owners: readonly string[];
};

export function activeKeyCommands(
  registrations: ReadonlyMap<string, readonly KeyCommand[]>,
) {
  const claims = new Map<string, { owner: string; command: KeyCommand }[]>();
  for (const [owner, commands] of registrations)
    for (const command of commands) {
      const combo = keyCombo(keyBindings[command.binding]);
      claims.set(combo, [...(claims.get(combo) ?? []), { owner, command }]);
    }
  const commands: KeyCommand[] = [];
  const conflicts: KeyCommandConflict[] = [];
  for (const [combo, claimed] of claims) {
    const [first, ...rest] = claimed;
    if (!first) continue;
    if (rest.length === 0) commands.push(first.command);
    else conflicts.push({ combo, owners: claimed.map((claim) => claim.owner) });
  }
  return { commands, conflicts };
}

export function pressKeyCommand(
  registrations: ReadonlyMap<string, readonly KeyCommand[]>,
  id: string,
) {
  activeKeyCommands(registrations)
    .commands.find((command) => command.binding === id)
    ?.run();
}

export function nativeKeyCommand(command: KeyCommand): NativeKeyCommand {
  const binding = keyBindings[command.binding];
  return {
    id: command.binding,
    title: command.title ?? binding.title,
    group: keyGroups[binding.group],
    input: binding.key,
    modifiers: binding.modifiers,
    whileTyping: (binding.modifiers as readonly KeyModifier[]).includes(
      'command',
    ),
  };
}

const modifierGlyphs: Record<KeyModifier, string> = {
  control: '⌃',
  option: '⌥',
  shift: '⇧',
  command: '⌘',
};

const keyGlyphs: Partial<Record<KeyInput, string>> = {
  up: '↑',
  down: '↓',
  left: '←',
  right: '→',
  return: '↩',
  escape: 'Esc',
  tab: '⇥',
  space: 'Space',
};

export function keyLabel({ key, modifiers }: KeyBinding) {
  return [
    ...modifierOrder
      .filter((modifier) => modifiers.includes(modifier))
      .map((modifier) => modifierGlyphs[modifier]),
    keyGlyphs[key] ?? key.toUpperCase(),
  ].join('');
}

export function keyShortcutSections() {
  return keyGroupOrder.map((group) => {
    const labels = new Map<string, string[]>();
    for (const binding of Object.values<KeyBinding>(keyBindings))
      if (binding.group === group)
        labels.set(binding.title, [
          ...(labels.get(binding.title) ?? []),
          keyLabel(binding),
        ]);
    return {
      title: keyGroups[group],
      shortcuts: [...labels].map(([title, keys]) => ({ title, keys })),
    };
  });
}
