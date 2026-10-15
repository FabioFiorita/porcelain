import { useAtomMount } from '@effect/atom-react';
import { Atom } from 'effect/reactivity';
import { onUnauthorized, reportUnauthorized } from '@/shared/api/unauthorized';
import { accessSession, applicationRuntime } from '../store';

const unauthorizedSubscription = Atom.make((get) => {
  get.addFinalizer(
    onUnauthorized(() => {
      applicationRuntime.runFork(accessSession.clear());
    }),
  );
});

export function useSignOutWhenUnauthorized() {
  useAtomMount(unauthorizedSubscription);
  return reportUnauthorized;
}
