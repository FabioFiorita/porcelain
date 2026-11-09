import { Atom } from 'effect/reactivity';
export const reviewContinuation = Atom.family((_owner: string) =>
  Atom.make((get) => {
    let active = true;
    get.addFinalizer(() => {
      active = false;
    });
    return (advance: () => void) => {
      if (active) advance();
    };
  }).pipe(Atom.setIdleTTL(0)),
);
