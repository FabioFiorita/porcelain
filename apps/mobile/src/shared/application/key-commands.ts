import { useAtomMount, useAtomSet, useAtomValue } from '@effect/atom-react';
import { useIsFocused } from 'expo-router';
import { useId, useState } from 'react';
import { Atom } from 'effect/reactivity';
import {
  activeKeyCommands,
  nativeKeyCommand,
  pressKeyCommand,
  type KeyBindingName,
  type KeyCommand,
} from '../rules/key-commands';
import {
  activeList,
  moveCursor,
  nextList,
  treeStep,
  type CursorRow,
} from '../rules/list-cursor';
import {
  onNativeKeyCommand,
  setNativeKeyCommands,
} from '../adapters/key-commands';

type Registrations = ReadonlyMap<string, readonly KeyCommand[]>;

export const keyRegistrations = Atom.make<Registrations>(new Map()).pipe(
  Atom.keepAlive,
);

const keyRegistration = Atom.family(
  ({ owner, commands }: { owner: string; commands: readonly KeyCommand[] }) =>
    Atom.make((get) => {
      if (commands.length === 0) return;
      get.set(
        keyRegistrations,
        new Map(get.once(keyRegistrations)).set(owner, commands),
      );
      const registry = get.registry;
      get.addFinalizer(() => {
        const current = registry.get(keyRegistrations);
        if (current.get(owner) !== commands) return;
        const next = new Map(current);
        next.delete(owner);
        registry.set(keyRegistrations, next);
      });
    }),
);

export const keyCommandSync = Atom.make((get) => {
  const { commands, conflicts } = activeKeyCommands(get(keyRegistrations));
  if (conflicts.length > 0)
    console.error('Two live owners claim the same shortcut', conflicts);
  setNativeKeyCommands(commands.map(nativeKeyCommand));
});

export const keyCommandRouting = Atom.make((get) => {
  const registry = get.registry;
  get.addFinalizer(
    onNativeKeyCommand((id) =>
      pressKeyCommand(registry.get(keyRegistrations), id),
    ),
  );
});

export function useKeyCommands(commands: readonly KeyCommand[]) {
  const owner = useId();
  useAtomMount(keyRegistration({ owner, commands }));
}

export function useScreenKeyCommands(commands: readonly KeyCommand[]) {
  const focused = useIsFocused();
  useKeyCommands(focused ? commands : []);
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
  useScreenKeyCommands(
    actions.flatMap((action) =>
      action.shortcut && action.onPress && !action.disabled
        ? [{ binding: action.shortcut, title: action.label, run: action.onPress }]
        : [],
    ),
  );
}

const lists = Atom.make<readonly string[]>([]).pipe(Atom.keepAlive);
const chosenList = Atom.make<string | undefined>(undefined).pipe(
  Atom.keepAlive,
);
const focusedList = Atom.make((get) =>
  activeList(get(lists), get(chosenList)),
);
const absentList = Atom.make(undefined);

const listPresence = Atom.family((owner: string) =>
  Atom.make((get) => {
    get.set(lists, [
      ...get.once(lists).filter((entry) => entry !== owner),
      owner,
    ]);
    const registry = get.registry;
    get.addFinalizer(() =>
      registry.set(
        lists,
        registry.get(lists).filter((entry) => entry !== owner),
      ),
    );
  }),
);

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
}: {
  rows: readonly CursorRow[];
  selected?: string | undefined;
  onOpen: (key: string) => void;
  onToggle?: ((key: string) => void) | undefined;
  onSearch?: (() => void) | undefined;
}): ListCursor {
  const owner = useId();
  const focused = useIsFocused();
  useAtomMount(focused ? listPresence(owner) : absentList);
  const present = useAtomValue(lists);
  const active = useAtomValue(focusedList) === owner;
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
    active
      ? [
          { binding: 'next', run: () => move('next') },
          { binding: 'nextJ', run: () => move('next') },
          { binding: 'previous', run: () => move('previous') },
          { binding: 'previousK', run: () => move('previous') },
          ...(live ? [{ binding: 'open' as const, run: () => onOpen(live) }] : []),
          ...(onToggle
            ? [
                { binding: 'expand' as const, run: () => step('in') },
                { binding: 'collapse' as const, run: () => step('out') },
              ]
            : []),
          ...(onSearch ? [{ binding: 'search' as const, run: onSearch }] : []),
          ...(present.length > 1
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
  return {
    highlighted: active ? live : undefined,
    claim: () => choose(owner),
  };
}
