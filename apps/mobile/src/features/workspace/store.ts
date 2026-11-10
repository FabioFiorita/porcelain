import { useAtomSet, useAtomValue } from '@effect/atom-react';
import type { ReviewComparison } from '../../shared/rules/review-comparison';
import { Atom } from 'effect/reactivity';

export const phoneReviewComparison = Atom.family((_workspace: string) =>
  Atom.make<ReviewComparison>({ kind: 'worktree' }).pipe(Atom.keepAlive),
);

export const reviewListOffset = Atom.family((_owner: string) =>
  Atom.make(0).pipe(Atom.keepAlive),
);

export const reviewFileScope = Atom.family((_owner: string) =>
  Atom.make<string | undefined>(undefined).pipe(Atom.keepAlive),
);

export const diffPageCurrent = Atom.family((_page: string) =>
  Atom.make(0).pipe(Atom.keepAlive),
);

export const diffPageOpening = Atom.family((page: string) =>
  Atom.make((get) => get.once(diffPageCurrent(page))).pipe(Atom.setIdleTTL(0)),
);

export const diffPageStuck = Atom.family((_page: string) =>
  Atom.make<number | undefined>(undefined),
);

export const chooseReviewFileScope = Atom.fnSync(
  (input: { owner: string; scope: string }, get) =>
    get.set(reviewFileScope(input.owner), input.scope),
);

const initialReviewListOffset = Atom.family((owner: string) =>
  Atom.make((get) => get.once(reviewListOffset(owner))).pipe(
    Atom.setIdleTTL(0),
  ),
);

export function useReviewListOffset(owner: string) {
  return {
    initialOffset: useAtomValue(initialReviewListOffset(owner)),
    onScrollOffset: useAtomSet(reviewListOffset(owner)),
  };
}
