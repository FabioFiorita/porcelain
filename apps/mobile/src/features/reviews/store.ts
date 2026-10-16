import { useAtom } from '@effect/atom-react';
import { Atom } from 'effect/reactivity';
import type { WalkthroughKey } from '@porcelain/client/reviews/rules';

type Place = {
  stop: WalkthroughKey;
  summary: boolean;
  step?: string;
};

const places = Atom.family((_review: string) =>
  Atom.make<Place>({ stop: 'briefing', summary: false }).pipe(Atom.keepAlive),
);

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

export function useReviewPlace(review: string) {
  return useAtom(places(review));
}
