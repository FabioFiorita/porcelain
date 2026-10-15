import { useAtomMount } from '@effect/atom-react';
import { Atom } from 'effect/reactivity';

const workspaceRetry = Atom.family((reset: () => void) =>
  Atom.make((get) => {
    window.addEventListener('focus', reset);
    window.addEventListener('online', reset);
    window.addEventListener('visibilitychange', reset);
    get.addFinalizer(() => {
      window.removeEventListener('focus', reset);
      window.removeEventListener('online', reset);
      window.removeEventListener('visibilitychange', reset);
    });
  }),
);

export function useWorkspaceRetry(reset: () => void) {
  useAtomMount(workspaceRetry(reset));
}
