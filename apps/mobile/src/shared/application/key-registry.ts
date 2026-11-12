import { Atom } from 'effect/reactivity';
import type { KeyCommand } from '../rules/key-commands';
import { activeList, keyedLists, tabHolder } from '../rules/list-cursor';

export type KeyOwner =
  | 'app'
  | 'worktree-sections'
  | 'list-cursor'
  | 'list-away'
  | 'worktree-search'
  | `document:${string}`;

export const keyRegistrations = Atom.make<
  ReadonlyMap<KeyOwner, readonly KeyCommand[]>
>(new Map()).pipe(Atom.keepAlive);

export const keyRegistration = Atom.family(
  ({ owner, commands }: { owner: KeyOwner; commands: readonly KeyCommand[] }) =>
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

export const listTab = Atom.make((get) =>
  tabHolder(get(keyLists), get(away.slot) !== undefined),
);

export const focusedList = Atom.make((get) =>
  activeList(get(keyLists), get(chosenList)),
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
