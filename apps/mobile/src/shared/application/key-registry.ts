import { Atom } from 'effect/reactivity';
import type { KeyCommand, ScreenKeyBinding } from '../rules/key-commands';
import {
  activeList,
  keyedLists,
  nextList,
  tabHolder,
} from '../rules/list-cursor';

export type KeyOwner =
  | 'app'
  | 'worktree-sections'
  | 'list-cursor'
  | 'list-tab'
  | `document:${string}`;

export type OwnedKeyCommand = KeyCommand & { binding: ScreenKeyBinding };

const keyRegistrations = Atom.make<
  ReadonlyMap<KeyOwner, readonly OwnedKeyCommand[]>
>(new Map()).pipe(Atom.keepAlive);

export const keyRegistration = Atom.family(
  ({
    owner,
    commands,
  }: {
    owner: KeyOwner;
    commands: readonly OwnedKeyCommand[];
  }) =>
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
        const remaining = new Map(current);
        remaining.delete(owner);
        registry.set(keyRegistrations, remaining);
      });
    }).pipe(Atom.setIdleTTL(0)),
);

export const lists = Atom.make<readonly string[]>([]).pipe(Atom.keepAlive);

export const chosenList = Atom.make<string | undefined>(undefined).pipe(
  Atom.keepAlive,
);

function listSlot() {
  const slot = Atom.make<string | undefined>(undefined).pipe(Atom.keepAlive);
  const claim = Atom.family((owner: string) =>
    Atom.make((get) => {
      get.set(slot, owner);
      const registry = get.registry;
      get.addFinalizer(() => {
        if (registry.get(slot) === owner) registry.set(slot, undefined);
      });
    }).pipe(Atom.setIdleTTL(0)),
  );
  return { slot, claim };
}

const over = listSlot();

const away = listSlot();

export const listOver = over.claim;

export const listAway = away.claim;

export const keyLists = Atom.make((get) =>
  keyedLists(get(lists), get(over.slot)),
);

export const focusedList = Atom.make((get) =>
  activeList(get(keyLists), get(chosenList)),
);

export const liveKeyCommands = Atom.make(
  (get): ReadonlyMap<KeyOwner, readonly KeyCommand[]> => {
    const registrations = get(keyRegistrations);
    if (tabHolder(get(keyLists), get(away.slot) !== undefined) === undefined)
      return registrations;
    const registry = get.registry;
    return new Map<KeyOwner, readonly KeyCommand[]>(registrations).set(
      'list-tab',
      [
        {
          binding: 'nextList',
          run: () => {
            const next = nextList(
              registry.get(keyLists),
              registry.get(focusedList),
            );
            if (next !== undefined) registry.set(chosenList, next);
          },
        },
      ],
    );
  },
);

export const absentList = Atom.make(undefined);

export const listPresence = Atom.family((owner: string) =>
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
  }).pipe(Atom.setIdleTTL(0)),
);
