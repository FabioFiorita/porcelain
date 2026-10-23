import {
  reviewListRowContext,
  reviewListSignal,
  type ReviewListEntry,
} from '@porcelain/client/reviews/rules';

export function worktreeRow(
  entry: ReviewListEntry,
  multipleProjects: boolean,
  selected: boolean,
) {
  const signal = reviewListSignal(entry);
  const icons = {
    Projects: 'folder',
    'Needs you': 'review',
    'Waiting on agent': 'history',
    'Ready to merge': 'check',
    'No review': 'review',
    Closed: 'closed',
  } as const;
  return {
    context: reviewListRowContext(entry, multipleProjects),
    icon:
      signal?.tone === 'destructive'
        ? ('warning' as const)
        : icons[entry.group],
    tone: signal?.tone ?? 'muted',
    accessibilityLabel: [
      ...new Set([
        entry.title,
        entry.projectName,
        entry.branch,
        entry.group,
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
