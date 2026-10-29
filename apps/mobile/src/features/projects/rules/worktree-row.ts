import {
  reviewListCheckout,
  reviewListRow,
  reviewListSignal,
  type ReviewListEntry,
} from '@porcelain/client/reviews/rules';

export function worktreeRow(entry: ReviewListEntry, selected: boolean) {
  const signal = reviewListSignal(entry);
  const row = reviewListRow(entry);
  const statuses = {
    Projects: 'none',
    'Needs you': 'needs-you',
    'Waiting on agent': 'waiting',
    'Ready to merge': 'ready',
    'No review': 'none',
    Closed: 'closed',
  } as const;
  return {
    ...row,
    status:
      signal?.tone === 'destructive'
        ? ('failed' as const)
        : statuses[entry.group],
    accessibilityLabel: [
      ...new Set([
        row.title,
        entry.projectName,
        reviewListCheckout(entry).full,
        entry.group === 'Projects' ? 'No review' : entry.group,
        entry.pullRequestNumber
          ? `Pull request #${entry.pullRequestNumber}`
          : undefined,
        entry.reviewId
          ? `${entry.reviewed}/${entry.total} decisions reviewed`
          : undefined,
        ...entry.badges.map((badge) => badge.label),
        selected ? 'current' : undefined,
        entry.disabled ? 'unavailable' : undefined,
      ]),
    ]
      .filter(Boolean)
      .join(', '),
  };
}
