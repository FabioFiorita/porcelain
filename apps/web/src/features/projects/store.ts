import { Atom, AtomRef } from 'effect/reactivity';
import { useAtomRef } from '@effect/atom-react';

export const projectFolder = Atom.make<string | undefined>(undefined);

const collapsedGroups = AtomRef.make<ReadonlySet<string>>(new Set());

export function useGroupOpen(group: string) {
  const collapsed = useAtomRef(collapsedGroups);
  return {
    open: !collapsed.has(group),
    setOpen: (open: boolean) =>
      collapsedGroups.update((current) => {
        const next = new Set(current);
        if (open) next.delete(group);
        else next.add(group);
        return next;
      }),
  };
}
