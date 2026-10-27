import type { ReviewComparison } from '../../../shared/rules/review-comparison';

export type ReviewTab =
  | { readonly title: 'Review'; readonly progress: string | undefined }
  | { readonly title: 'Changes'; readonly progress: undefined };

export function reviewTab(
  published: boolean | undefined,
  decisions: readonly { readonly reviewed: boolean }[] | undefined,
  comparison: ReviewComparison,
): ReviewTab {
  if (published === false) return { title: 'Changes', progress: undefined };
  if (comparison.kind === 'branch' || !decisions || decisions.length === 0)
    return { title: 'Review', progress: undefined };
  return {
    title: 'Review',
    progress: `${decisions.filter((decision) => decision.reviewed).length}/${decisions.length}`,
  };
}
