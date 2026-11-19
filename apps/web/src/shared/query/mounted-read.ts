import { useAtomValue } from '@effect/atom-react';
import { Atom, type AtomRegistry } from 'effect/reactivity';
import { useSyncExternalStore } from 'react';

type ReadOwner = {
  subscribe: (notify: () => void) => () => void;
  mounted: () => boolean;
};

const registryOf = Atom.make((get) => get.registry);
const owners = new WeakMap<
  AtomRegistry.AtomRegistry,
  WeakMap<Atom.Atom<unknown>, ReadOwner>
>();

function mountedOwner(
  registry: AtomRegistry.AtomRegistry,
  atom: Atom.Atom<unknown>,
): ReadOwner {
  const byAtom = owners.get(registry) ?? new WeakMap();
  owners.set(registry, byAtom);
  const existing = byAtom.get(atom);
  if (existing) return existing;
  let readers = 0;
  const owner: ReadOwner = {
    subscribe(notify) {
      const unsubscribe = registry.subscribe(atom, notify);
      readers++;
      return () => {
        readers--;
        unsubscribe();
      };
    },
    mounted: () => readers > 0,
  };
  byAtom.set(atom, owner);
  return owner;
}

export function useMountedRead<A>(atom: Atom.Atom<A>): A | undefined {
  const registry = useAtomValue(registryOf);
  const owner = mountedOwner(registry, atom);
  return useSyncExternalStore(owner.subscribe, () =>
    owner.mounted() ? registry.get(atom) : undefined,
  );
}
