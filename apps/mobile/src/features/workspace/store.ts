import { useAtomSet, useAtomValue } from '@effect/atom-react';
import type { ReviewComparison } from '../../shared/rules/review-comparison';
import { Atom } from 'effect/reactivity';
import type {
  CommentAnchor,
  CommentTarget,
} from '@porcelain/client/reviews/rules';

import type { ReviewRange } from '../../components/ui/review-annotation';

export const phoneReviewComparison = Atom.family((_workspace: string) =>
  Atom.make<ReviewComparison>({ kind: 'worktree' }).pipe(Atom.keepAlive),
);

export const reviewListOffset = Atom.family((_owner: string) =>
  Atom.make(0).pipe(Atom.keepAlive),
);

export const reviewFileScope = Atom.family((_owner: string) =>
  Atom.make<string | undefined>(undefined).pipe(Atom.keepAlive),
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
export const documentSelectionState = Atom.family(
  (_: {
    environmentId: string;
    projectId: string;
    worktreeId: string;
    document: string;
    comparison: CommentTarget['comparison'];
  }) =>
    Atom.make<{ range: ReviewRange; target: CommentTarget } | undefined>(
      undefined,
    ).pipe(Atom.keepAlive),
);

export type ComposerTarget = {
  anchor: CommentAnchor;
  threadId?: string | undefined;
  reviewId?: string | undefined;
  reviewRevision?: number | undefined;
};

export type CommentDraft = {
  target: ComposerTarget | undefined;
  body: string;
  invalid: string | undefined;
  intent: { body: string; threadId: string; messageId: string } | undefined;
};

export const commentDraftState = Atom.family((_document: string) =>
  Atom.make<CommentDraft | undefined>(undefined).pipe(Atom.keepAlive),
);
