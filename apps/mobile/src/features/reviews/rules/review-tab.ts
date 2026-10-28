import {
  stopDone,
  type WalkthroughStop,
  type ReviewStatus,
} from '@porcelain/client/reviews/rules';
import type { ReviewComparison } from '../../../shared/rules/review-comparison';

export type ReviewTab =
  | { readonly title: 'Review'; readonly progress: string | undefined }
  | { readonly title: 'Changes'; readonly progress: undefined };

export function reviewTab(
  published: boolean | undefined,
  progress:
    | {
        stops: readonly WalkthroughStop[];
        items: readonly { path: string; reviewStatus: ReviewStatus }[];
        decisions: ReadonlyMap<string, { reviewed: boolean; stale: boolean }>;
      }
    | undefined,
  comparison: ReviewComparison,
): ReviewTab {
  if (published === false) return { title: 'Changes', progress: undefined };
  const decisions = progress?.stops.filter((stop) => stop.kind === 'decision');
  if (comparison.kind === 'branch' || !progress || !decisions?.length)
    return { title: 'Review', progress: undefined };
  return {
    title: 'Review',
    progress: `${decisions.filter((stop) => stopDone(stop, progress.items, progress.decisions)).length}/${decisions.length}`,
  };
}
