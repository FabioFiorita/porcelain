import { useId, type ComponentRef } from 'react';
import type { ScrollView, View } from 'react-native';
import { useAtom, useAtomValue } from '@effect/atom-react';
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

const reviewNavigation = Atom.family((_owner: string) =>
  Atom.make((get) => {
    let scroll: ComponentRef<typeof ScrollView> | null = null;
    let content: ComponentRef<typeof View> | null = null;
    let decision: ComponentRef<typeof View> | null = null;
    const scrollToDecision = () =>
      decision?.measureInWindow((_x, targetY) =>
        content?.measureInWindow((_contentX, contentY) =>
          scroll?.scrollTo({ y: targetY - contentY, animated: false }),
        ),
      );
    get.addFinalizer(() => {
      scroll = null;
      content = null;
      decision = null;
    });
    return {
      scroll: (view: ComponentRef<typeof ScrollView> | null) => {
        scroll = view;
        return () => {
          if (scroll === view) scroll = null;
        };
      },
      content: (view: ComponentRef<typeof View> | null) => {
        content = view;
        return () => {
          if (content === view) content = null;
        };
      },
      decision: (view: ComponentRef<typeof View> | null) => {
        decision = view;
        scrollToDecision();
        return () => {
          if (decision === view) decision = null;
        };
      },
      scrollToDecision,
      scrollToStart: () => scroll?.scrollTo({ y: 0, animated: false }),
    };
  }),
);

export function useReviewNavigation() {
  return useAtomValue(reviewNavigation(useId()));
}
