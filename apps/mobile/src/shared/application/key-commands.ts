import { useAtomMount, useAtomSet, useAtomValue } from '@effect/atom-react';
import { useIsFocused } from 'expo-router';
import { useId, useState } from 'react';
import { Atom } from 'effect/reactivity';
import {
  absentList,
  chosenList,
  focusedList,
  keyLists,
  keyRegistration,
  keyRegistrations,
  listAway,
  listOver,
  listPresence,
  listTab,
  type KeyOwner,
} from './key-registry';
import {
  activeKeyCommands,
  nativeKeyCommand,
  pressKeyCommand,
  type KeyBindingName,
  type KeyCommand,
} from '../rules/key-commands';
import {
  moveCursor,
  nextList,
  treeStep,
  type CursorRow,
} from '../rules/list-cursor';
import {
  onNativeKeyCommand,
  setNativeKeyCommands,
} from '../adapters/key-commands';

const nativeKeyPayload = Atom.make((get) => {
  const { commands, conflicts } = activeKeyCommands(get(keyRegistrations));
  if (conflicts.length > 0)
    console.error('Two live owners claim the same shortcut', conflicts);
  return JSON.stringify(commands.map(nativeKeyCommand));
});

export const keyCommandSync = Atom.make((get) => {
  setNativeKeyCommands(get(nativeKeyPayload));
});

export const keyCommandRouting = Atom.make((get) => {
  const registry = get.registry;
  get.addFinalizer(
    onNativeKeyCommand((id) =>
      pressKeyCommand(registry.get(keyRegistrations), id),
    ),
  );
});

export function useKeyCommands(
  owner: KeyOwner,
  commands: readonly KeyCommand[],
) {
  useAtomMount(keyRegistration({ owner, commands }));
}

export function useScreenKeyCommands(
  owner: KeyOwner,
  commands: readonly KeyCommand[],
) {
  const focused = useIsFocused();
  useKeyCommands(owner, focused ? commands : []);
}

export function useDocumentKeys(
  actions: readonly {
    kind: string;
    label: string;
    shortcut?: KeyBindingName | undefined;
    disabled?: boolean | undefined;
    onPress?: () => void;
  }[],
) {
  const keyed = actions.flatMap((action) =>
    action.shortcut ? [{ ...action, shortcut: action.shortcut }] : [],
  );
  useScreenKeyCommands(
    `document:${keyed.map((action) => action.shortcut).join(',')}`,
    keyed.flatMap((action) =>
      action.onPress && !action.disabled
        ? [
            {
              binding: action.shortcut,
              title: action.label,
              run: action.onPress,
            },
          ]
        : [],
    ),
  );
}

export type ListCursor = {
  highlighted: string | undefined;
  claim: () => void;
};

export function useListCursor({
  rows,
  selected,
  onOpen,
  onToggle,
  onSearch,
  hidden = false,
  over = false,
}: {
  hidden?: boolean | undefined;
  over?: boolean | undefined;
  rows: readonly CursorRow[];
  selected?: string | undefined;
  onOpen: (key: string) => void;
  onToggle?: ((key: string) => void) | undefined;
  onSearch?: (() => void) | undefined;
}): ListCursor {
  const owner = useId();
  const focused = useIsFocused();
  useAtomMount(focused && !hidden ? listPresence(owner) : absentList);
  useAtomMount(focused && !hidden && over ? listOver(owner) : absentList);
  useAtomMount(focused && hidden ? listAway(owner) : absentList);
  const present = useAtomValue(keyLists);
  const tab = useAtomValue(listTab);
  const current = useAtomValue(focusedList);
  const active = current === owner;
  const choose = useAtomSet(chosenList);
  const [highlighted, setHighlighted] = useState<string>();
  const live = rows.some((row) => row.key === highlighted)
    ? highlighted
    : undefined;
  const move = (direction: 'next' | 'previous') =>
    setHighlighted(moveCursor(rows, live, direction, selected));
  const step = (direction: 'in' | 'out') => {
    const next = treeStep(rows, live, direction);
    if (next?.kind === 'toggle') onToggle?.(next.key);
    else if (next) setHighlighted(next.key);
  };
  useScreenKeyCommands(
    'list-cursor',
    active
      ? [
          { binding: 'next', run: () => move('next') },
          { binding: 'nextJ', run: () => move('next') },
          { binding: 'previous', run: () => move('previous') },
          { binding: 'previousK', run: () => move('previous') },
          ...(live
            ? [{ binding: 'open' as const, run: () => onOpen(live) }]
            : []),
          ...(onToggle
            ? [
                { binding: 'expand' as const, run: () => step('in') },
                { binding: 'collapse' as const, run: () => step('out') },
              ]
            : []),
          ...(onSearch ? [{ binding: 'search' as const, run: onSearch }] : []),
          ...(tab === 'lists'
            ? [
                {
                  binding: 'nextList' as const,
                  run: () => choose(nextList(present, owner)),
                },
              ]
            : []),
        ]
      : [],
  );
  useScreenKeyCommands(
    'list-away',
    hidden && tab === 'away'
      ? [
          {
            binding: 'nextList',
            run: () => {
              const next = nextList(present, current);
              if (next !== undefined) choose(next);
            },
          },
        ]
      : [],
  );
  return {
    highlighted: active ? live : undefined,
    claim: () => choose(owner),
  };
}
