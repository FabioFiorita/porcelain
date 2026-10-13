import { useAtomRef } from '@effect/atom-react';
import { AtomRef } from 'effect/reactivity';

const historyWide = AtomRef.make(false);
const setHistoryWide = (wide: boolean) => {
  historyWide.set(wide);
};

export function useHistoryPresentation() {
  return { wide: useAtomRef(historyWide), setWide: setHistoryWide };
}
