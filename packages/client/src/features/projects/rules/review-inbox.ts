import {
  emptyNavigatorFilter,
  navigatorCardReviewLabel,
  navigatorEntryMatches,
  type NavigatorEntry,
  type NavigatorReview,
} from './worktree-navigator.ts';

type AvailableReview = Extract<NavigatorReview, { state: 'available' }>;
type ReviewInboxStatus = 'decision' | 'new' | 'available';
type ReviewInboxRow = {
  key: string;
  entry: NavigatorEntry;
  review: AvailableReview;
  status: ReviewInboxStatus;
  label: string;
};
type ReviewInboxProject = {
  key: string;
  name: string;
  environmentName: string;
  rows: readonly ReviewInboxRow[];
};
export type ReviewInbox = {
  decisions: readonly ReviewInboxRow[];
  projects: readonly ReviewInboxProject[];
  reading: boolean;
};

function reviewInboxStatus(review: AvailableReview): ReviewInboxStatus {
  if (review.closed || review.archived) return 'available';
  if (review.timing === 'decision') return 'decision';
  return review.latestRevision > review.lastSeenRevision ? 'new' : 'available';
}

export function reviewInbox(
  entries: readonly NavigatorEntry[],
  older = false,
): ReviewInbox {
  const rows = entries.flatMap((entry): ReviewInboxRow[] =>
    entry.review.state === 'available' &&
    (older || (!entry.review.closed && !entry.review.archived))
      ? [
          {
            key: entry.key,
            entry,
            review: entry.review,
            status: reviewInboxStatus(entry.review),
            label: navigatorCardReviewLabel(entry),
          },
        ]
      : [],
  );
  const projects = new Map<string, ReviewInboxProject>();
  for (const row of rows) {
    if (row.status === 'decision') continue;
    const key = `${row.entry.environmentId}/${row.entry.projectId}`;
    const project = projects.get(key);
    projects.set(key, {
      key,
      name: row.entry.projectName,
      environmentName: row.entry.environmentName,
      rows: [...(project?.rows ?? []), row],
    });
  }
  return {
    decisions: rows.filter((row) => row.status === 'decision'),
    projects: [...projects.values()].sort(
      (a, b) =>
        a.name.localeCompare(b.name) ||
        a.environmentName.localeCompare(b.environmentName) ||
        a.key.localeCompare(b.key),
    ),
    reading: entries.some((entry) => entry.review.state === 'loading'),
  };
}

export function searchReviewInbox(
  inbox: ReviewInbox,
  query: string,
): ReviewInbox {
  if (query.trim() === '') return inbox;
  const matches = (row: ReviewInboxRow) =>
    navigatorEntryMatches(row.entry, query, emptyNavigatorFilter);
  return {
    ...inbox,
    decisions: inbox.decisions.filter(matches),
    projects: inbox.projects.flatMap((project) => {
      const rows = project.rows.filter(matches);
      return rows.length > 0 ? [{ ...project, rows }] : [];
    }),
  };
}
