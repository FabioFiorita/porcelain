import { Atom } from 'effect/reactivity';
import {
  emptyReviewListFilter,
  type ReviewListFilter,
} from '../../reviews/rules/review-list.ts';

export const worktreeNavigatorState = Atom.make<{
  readonly query: string;
  readonly filter: ReviewListFilter;
}>({
  query: '',
  filter: emptyReviewListFilter,
}).pipe(Atom.keepAlive);
