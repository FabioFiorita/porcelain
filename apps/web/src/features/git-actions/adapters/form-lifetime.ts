import { useAtomMount } from '@effect/atom-react';
import { Atom } from 'effect/reactivity';

const draftLifetime = Atom.family((controllers: Set<AbortController>) =>
  Atom.make((get) => {
    get.addFinalizer(() => {
      for (const controller of controllers) controller.abort();
      controllers.clear();
    });
  }),
);

export function useDraftCancellation(controllers: Set<AbortController>) {
  useAtomMount(draftLifetime(controllers));
}
